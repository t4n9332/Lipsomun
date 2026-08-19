import { loginAction } from "../actions";

export const metadata = { title: "관리자 로그인" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="admin-wrap" style={{ maxWidth: 420 }}>
      <div className="admin-card">
        <h2>🔐 관리자 로그인</h2>
        {error && (
          <div className="notice err">비밀번호가 올바르지 않습니다.</div>
        )}
        <form action={loginAction}>
          <label>비밀번호</label>
          <input type="password" name="password" autoFocus required />
          <div style={{ marginTop: 18 }}>
            <button className="btn" type="submit">
              로그인
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
