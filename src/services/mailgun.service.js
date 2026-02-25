function hasMailgunConfig() {
  return Boolean(
    process.env.MAILGUN_API_KEY &&
    process.env.MAILGUN_DOMAIN &&
    process.env.MAIL_FROM
  );
}

async function sendPasswordResetEmail({ to, resetUrl }) {
  if (!hasMailgunConfig()) {
    return { sent: false, reason: "Mailgun is not configured" };
  }

  const endpoint = `https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`;
  const auth = Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString("base64");

  const form = new URLSearchParams();
  form.set("from", process.env.MAIL_FROM);
  form.set("to", to);
  form.set("subject", "Reset your Food Tracker password");
  form.set(
    "text",
    `We received a request to reset your password.\n\nOpen this link to continue:\n${resetUrl}\n\nThis link expires in 30 minutes.`
  );

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: form.toString()
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Mailgun request failed (${response.status}): ${body}`);
  }

  return { sent: true };
}

module.exports = {
  hasMailgunConfig,
  sendPasswordResetEmail
};
