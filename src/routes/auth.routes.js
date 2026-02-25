const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const prisma = require("../lib/prisma");
const { hasMailgunConfig, sendPasswordResetEmail } = require("../services/mailgun.service");

function signToken(user, sid) {
  return jwt.sign(
    { id: user.id, role: user.role, sv: user.sessionVersion, sid },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
}

const authUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  profileImage: true,
  authProviders: true,
  sessionVersion: true
};

function buildUserResponse(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    profileImage: user.profileImage || null,
    authProviders: String(user.authProviders || "credentials")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
  };
}

function hashResetToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function passwordResetSetupError(err) {
  const missingModel = !prisma.passwordResetToken;
  const missingTable = err?.code === "P2021";

  if (missingModel || missingTable) {
    return "Password reset is not ready on backend. Run: npx prisma generate and npx prisma migrate dev";
  }

  return null;
}

function normalizeProvider(provider) {
  const value = String(provider || "").toLowerCase().trim();
  if (!value) return null;
  if (["google", "github", "facebook", "credentials"].includes(value)) return value;
  return null;
}

function appendProvider(existing, provider) {
  const items = String(existing || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  if (!provider) return Array.from(new Set(items)).join(",");
  return Array.from(new Set([...items, provider])).join(",");
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || null;
}

async function createSession(userId, req) {
  const sid = crypto.randomBytes(16).toString("hex");
  await prisma.userSession.create({
    data: {
      userId,
      sid,
      userAgent: String(req.headers["user-agent"] || "").slice(0, 190) || null,
      ipAddress: String(getClientIp(req) || "").slice(0, 190) || null,
      lastActiveAt: new Date()
    }
  });
  return sid;
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const emailText = String(email).trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: emailText } });
    if (existing) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: emailText,
        password: hashed,
        authProviders: "credentials"
      },
      select: authUserSelect
    });

    const sid = await createSession(user.id, req);
    const token = signToken(user, sid);
    res.status(201).json({ token, user: buildUserResponse(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const emailText = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: emailText },
      select: {
        ...authUserSelect,
        password: true
      }
    });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const sid = await createSession(user.id, req);
    const token = signToken(user, sid);

    res.json({
      token,
      user: buildUserResponse(user)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/social-login
router.post("/social-login", async (req, res) => {
  try {
    const { name, email, provider } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const providerName = normalizeProvider(provider) || "google";
    const emailText = String(email).trim().toLowerCase();
    let user = await prisma.user.findUnique({
      where: { email: emailText },
      select: {
        ...authUserSelect,
        password: true
      }
    });

    if (!user) {
      const randomPassword = crypto.randomBytes(24).toString("hex");
      const hashed = await bcrypt.hash(randomPassword, 10);
      user = await prisma.user.create({
        data: {
          name: name || emailText.split("@")[0],
          email: emailText,
          password: hashed,
          authProviders: providerName
        },
        select: {
          ...authUserSelect,
          password: true
        }
      });
    } else {
      const nextProviders = appendProvider(user.authProviders, providerName);
      user = await prisma.user.update({
        where: { id: user.id },
        data: { authProviders: nextProviders },
        select: {
          ...authUserSelect,
          password: true
        }
      });
    }

    const sid = await createSession(user.id, req);
    const token = signToken(user, sid);
    res.json({
      token,
      user: buildUserResponse(user)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/forgot-password
router.post("/forgot-password", async (req, res) => {
  try {
    if (!prisma.passwordResetToken) {
      throw new Error("PasswordResetToken Prisma model is unavailable");
    }

    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await prisma.user.findUnique({
      where: { email: String(email).trim().toLowerCase() },
      select: { id: true }
    });

    if (!user) {
      return res.json({
        message: "If an account exists, a reset link has been generated."
      });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const token = hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt
      }
    });

    const frontendBase = process.env.FRONTEND_URL || "http://localhost:3000";
    const resetUrl = `${frontendBase}/reset-password?token=${rawToken}`;
    let mailSent = false;
    try {
      const result = await sendPasswordResetEmail({ to: email, resetUrl });
      mailSent = result.sent;
    } catch (mailErr) {
      console.error("Mailgun error:", mailErr);
    }

    if (!mailSent) {
      console.log("Password reset link:", resetUrl);
    }

    const response = {
      message: "If an account exists, a reset link has been generated."
    };

    if (process.env.NODE_ENV !== "production" || !hasMailgunConfig()) {
      response.debugResetUrl = resetUrl;
    }

    return res.json(response);
  } catch (err) {
    console.error(err);
    const setupMessage = passwordResetSetupError(err);
    return res.status(500).json({ message: setupMessage || "Server error" });
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", async (req, res) => {
  try {
    if (!prisma.passwordResetToken) {
      throw new Error("PasswordResetToken Prisma model is unavailable");
    }

    const { token: rawToken, password } = req.body;

    if (!rawToken || !password) {
      return res.status(400).json({ message: "Token and password are required" });
    }

    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const token = hashResetToken(rawToken);
    const now = new Date();

    const resetRecord = await prisma.passwordResetToken.findFirst({
      where: {
        token,
        usedAt: null,
        expiresAt: { gt: now }
      },
      select: {
        id: true,
        userId: true
      }
    });

    if (!resetRecord) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.$transaction(async (tx) => {
      const consumeResult = await tx.passwordResetToken.updateMany({
        where: {
          id: resetRecord.id,
          usedAt: null
        },
        data: {
          usedAt: new Date()
        }
      });

      if (consumeResult.count !== 1) {
        throw new Error("Reset token already used");
      }

      await tx.user.update({
        where: { id: resetRecord.userId },
        data: {
          password: hashedPassword,
          sessionVersion: { increment: 1 }
        }
      });

      await tx.userSession.updateMany({
        where: { userId: resetRecord.userId, revokedAt: null },
        data: { revokedAt: new Date() }
      });
    });

    return res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error(err);
    const setupMessage = passwordResetSetupError(err);
    return res.status(500).json({ message: setupMessage || "Server error" });
  }
});

module.exports = router;
