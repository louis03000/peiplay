// 🔥 模組隔離測試版本 - 最小可執行版本
// 目的：確認問題是否出在 module 載入階段

export const runtime = "nodejs";

export async function POST() {
  return Response.json({ ok: true });
}
