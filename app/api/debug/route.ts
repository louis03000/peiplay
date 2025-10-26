export async function GET(req: Request) {
  console.log("DEBUG: route GET fired");
  const info = {
    ok: true,
    time: new Date().toISOString(),
    node: typeof process !== 'undefined' ? process.version : "no-process",
    env_sample: !!process.env.DATABASE_URL  // 不顯示值，只顯示是否存在
  };
  return new Response(JSON.stringify(info), { status: 200 });
}