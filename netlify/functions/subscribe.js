export default async function handler(req) {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const { email } = body;
  if (!email || !email.includes('@')) {
    return Response.json({ error: 'Invalid email.' }, { status: 400 });
  }

  const token = process.env.MAILERLITE_API_TOKEN;
  if (!token) {
    return Response.json({ error: 'Server misconfiguration.' }, { status: 500 });
  }

  const res = await fetch('https://connect.mailerlite.com/api/subscribers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      email,
      groups: ['171506753830126950'],
    }),
  });

  if (res.ok || res.status === 200 || res.status === 201) {
    return Response.json({ success: true });
  }

  const err = await res.json().catch(() => ({}));
  return Response.json({ error: err.message || 'Subscription failed.' }, { status: res.status });
}
