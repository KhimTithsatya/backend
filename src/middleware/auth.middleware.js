const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

module.exports = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const dbUser = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, role: true, sessionVersion: true }
    });

    if (!dbUser) {
      return res.status(401).json({ message: "User not found" });
    }

    if (Number(payload.sv || 0) !== Number(dbUser.sessionVersion || 0)) {
      return res.status(401).json({ message: "Session expired. Please sign in again." });
    }

    if (payload.sid) {
      const activeSession = await prisma.userSession.findFirst({
        where: {
          userId: payload.id,
          sid: payload.sid,
          revokedAt: null
        },
        select: { id: true }
      });

      if (!activeSession) {
        return res.status(401).json({ message: "Session is no longer active" });
      }

      await prisma.userSession.updateMany({
        where: { userId: payload.id, sid: payload.sid, revokedAt: null },
        data: { lastActiveAt: new Date() }
      });
    }

    req.user = { id: dbUser.id, role: dbUser.role, sid: payload.sid || null };
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};
