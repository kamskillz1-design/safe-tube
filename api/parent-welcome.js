function clean(value) {
  return String(value || "").trim().slice(0, 160);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed." });
  const email = clean(req.body?.email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ ok: false, error: "A valid email is required." });

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.PARENT_FROM_EMAIL || "SafeTube Kids <onboarding@resend.dev>";
  if (!apiKey) return res.status(200).json({ ok: true, sent: false, reason: "Email provider is not configured yet." });

  const site = clean(req.body?.site) || "https://safe-tube-eight.vercel.app";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Welcome to SafeTube Kids",
      html: `<p>Your SafeTube Kids parent account is ready.</p><p>Open the app to add a child profile and choose safe channels: <a href="${site}">${site}</a></p><p>If you did not create this account, you can ignore this email.</p>`,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    return res.status(502).json({ ok: false, error: "Welcome email could not be sent.", detail: detail.slice(0, 200) });
  }
  return res.status(200).json({ ok: true, sent: true });
}
