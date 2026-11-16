export async function GET(): Promise<Response> {
  return Response.json(
    { status: 'ok', runtime: 'vercel-serverless' },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );
}
