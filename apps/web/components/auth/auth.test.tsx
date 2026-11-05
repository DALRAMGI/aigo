import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AccountPanel } from "./AccountPanel";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { LoginForm } from "./LoginForm";
import { SignupForm } from "./SignupForm";
import { SocialButtons } from "./SocialButtons";
import { clerkMessage } from "./clerkErrors";
import { safeRedirect } from "./redirect";

// user-event 의존성을 늘리지 않으려고 fireEvent로 감싼다.
const userEvent = {
  setup: () => ({
    type: (el: Element, text: string) => act(async () => void fireEvent.change(el, { target: { value: text } })),
    clear: (el: Element) => act(async () => void fireEvent.change(el, { target: { value: "" } })),
    click: (el: Element) => act(async () => void fireEvent.click(el)),
  }),
};

const ok = () => Promise.resolve({ error: null });
const m = vi.hoisted(() => ({
  signIn: {} as Record<string, any>,
  signUp: {} as Record<string, any>,
  user: {} as Record<string, any>,
  signOut: vi.fn(),
  request: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@clerk/nextjs", () => ({
  useSignIn: () => ({ signIn: m.signIn, errors: {}, fetchStatus: "idle" }),
  useSignUp: () => ({ signUp: m.signUp, errors: {}, fetchStatus: "idle" }),
  useUser: () => ({ isLoaded: true, user: m.user }),
  useClerk: () => ({ signOut: m.signOut }),
  useAuth: () => ({ isSignedIn: false }),
  HandleSSOCallback: () => null,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push, replace: m.push }) }));
vi.mock("next/link", () => ({ default: ({ href, ...p }: any) => <a href={href} {...p} /> }));
vi.mock("@/components/ui/Nav", () => ({ Nav: () => null }));
vi.mock("@/lib/api", () => ({ useApi: () => ({ request: m.request }) }));

const PASSWORD = "correct-horse-battery";

beforeEach(() => {
  m.signIn = {
    status: "needs_identifier",
    supportedSecondFactors: [{ strategy: "email_code" }],
    create: vi.fn(ok),
    password: vi.fn(ok),
    sso: vi.fn(ok),
    finalize: vi.fn(ok),
    reset: vi.fn(ok),
    mfa: { sendEmailCode: vi.fn(ok), verifyEmailCode: vi.fn(ok) },
    resetPasswordEmailCode: { sendCode: vi.fn(ok), verifyCode: vi.fn(ok), submitPassword: vi.fn(ok) },
  };
  m.signUp = {
    status: "missing_requirements",
    password: vi.fn(ok),
    finalize: vi.fn(ok),
    verifications: { sendEmailCode: vi.fn(ok), verifyEmailCode: vi.fn(ok) },
  };
  m.user = {
    fullName: "홍길동",
    firstName: "홍길동",
    primaryEmailAddress: { emailAddress: "a@b.co" },
    passwordEnabled: true,
    update: vi.fn(() => Promise.resolve()),
    setProfileImage: vi.fn(() => Promise.resolve()),
    updatePassword: vi.fn(() => Promise.resolve()),
  };
  m.request.mockResolvedValue(undefined);
  m.signOut.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test("가입 후 이메일 코드 화면으로 넘어간다", async () => {
  const user = userEvent.setup();
  render(<SignupForm />);
  await user.type(screen.getByLabelText("이메일"), "a@b.co");
  await user.type(screen.getByLabelText("비밀번호"), PASSWORD);
  await user.click(screen.getByRole("button", { name: "가입하기" }));

  expect(m.signUp.password).toHaveBeenCalledWith({ emailAddress: "a@b.co", password: PASSWORD });
  expect(m.signUp.verifications.sendEmailCode).toHaveBeenCalledTimes(1);
  expect(await screen.findByLabelText("인증 코드")).toBeTruthy();

  m.signUp.verifications.verifyEmailCode.mockImplementation(() => {
    m.signUp.status = "complete";
    return ok();
  });
  await user.type(screen.getByLabelText("인증 코드"), "424242");
  await user.click(screen.getByRole("button", { name: "확인" }));
  expect(m.signUp.verifications.verifyEmailCode).toHaveBeenCalledWith({ code: "424242" });
  await waitFor(() => expect(m.signUp.finalize).toHaveBeenCalled());
});

test("회원가입과 재설정 화면은 비밀번호 15자 규칙을 보여 준다", async () => {
  render(<SignupForm />);
  expect(screen.getByText(/15자 이상/)).toBeTruthy();
  cleanup();
  render(<ForgotPasswordForm />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("이메일"), "a@b.co");
  await user.click(screen.getByRole("button", { name: "코드 보내기" }));
  await user.type(await screen.findByLabelText("인증 코드"), "123456");
  await user.click(screen.getByRole("button", { name: "확인" }));
  expect((await screen.findAllByText(/15자 이상/)).length).toBeGreaterThan(0);
});

test("코드를 다시 보낼 수 있다", async () => {
  const user = userEvent.setup();
  render(<SignupForm />);
  await user.type(screen.getByLabelText("이메일"), "a@b.co");
  await user.type(screen.getByLabelText("비밀번호"), PASSWORD);
  await user.click(screen.getByRole("button", { name: "가입하기" }));
  await user.click(await screen.findByRole("button", { name: "코드 다시 보내기" }));
  expect(m.signUp.verifications.sendEmailCode).toHaveBeenCalledTimes(2);
});

test("비밀번호 재설정은 코드 확인 후 새 비밀번호를 받는다", async () => {
  const user = userEvent.setup();
  render(<ForgotPasswordForm />);
  await user.type(screen.getByLabelText("이메일"), "a@b.co");
  await user.click(screen.getByRole("button", { name: "코드 보내기" }));
  expect(m.signIn.create).toHaveBeenCalledWith({ identifier: "a@b.co" });
  expect(m.signIn.resetPasswordEmailCode.sendCode).toHaveBeenCalled();

  expect(screen.queryByLabelText("새 비밀번호")).toBeNull();
  await user.type(await screen.findByLabelText("인증 코드"), "424242");
  await user.click(screen.getByRole("button", { name: "확인" }));
  expect(m.signIn.resetPasswordEmailCode.verifyCode).toHaveBeenCalledWith({ code: "424242" });

  await user.type(await screen.findByLabelText("새 비밀번호"), PASSWORD);
  m.signIn.resetPasswordEmailCode.submitPassword.mockImplementation(() => {
    m.signIn.status = "complete";
    return ok();
  });
  await user.click(screen.getByRole("button", { name: "비밀번호 바꾸기" }));
  expect(m.signIn.resetPasswordEmailCode.submitPassword).toHaveBeenCalledWith({
    password: PASSWORD,
    signOutOfOtherSessions: true,
  });
  await waitFor(() => expect(m.signIn.finalize).toHaveBeenCalled());
});

test("로그인의 needs_client_trust 상태를 코드 화면으로 처리한다", async () => {
  const user = userEvent.setup();
  m.signIn.password.mockImplementation(() => {
    m.signIn.status = "needs_client_trust";
    return ok();
  });
  render(<LoginForm redirectUrl="/analyses" />);
  await user.type(screen.getByLabelText("이메일"), "a@b.co");
  await user.type(screen.getByLabelText("비밀번호"), PASSWORD);
  await user.click(screen.getByRole("button", { name: "로그인" }));

  expect(m.signIn.password).toHaveBeenCalledWith({ emailAddress: "a@b.co", password: PASSWORD });
  await waitFor(() => expect(m.signIn.mfa.sendEmailCode).toHaveBeenCalled());

  m.signIn.mfa.verifyEmailCode.mockImplementation(() => {
    m.signIn.status = "complete";
    return ok();
  });
  await user.type(await screen.findByLabelText("인증 코드"), "424242");
  await user.click(screen.getByRole("button", { name: "확인" }));
  expect(m.signIn.mfa.verifyEmailCode).toHaveBeenCalledWith({ code: "424242" });
  await waitFor(() => expect(m.signIn.finalize).toHaveBeenCalled());
});

test("로그인 오류는 한국어로 보이고 비밀번호 입력은 유지된다", async () => {
  const user = userEvent.setup();
  m.signIn.password.mockResolvedValueOnce({
    error: { code: "form_password_incorrect", message: "Password is incorrect." },
  });
  render(<LoginForm />);
  await user.type(screen.getByLabelText("이메일"), "a@b.co");
  await user.type(screen.getByLabelText("비밀번호"), PASSWORD);
  await user.click(screen.getByRole("button", { name: "로그인" }));
  expect(await screen.findByText(/비밀번호가 맞지 않습니다/)).toBeTruthy();
  expect((screen.getByLabelText("비밀번호") as HTMLInputElement).value).toBe(PASSWORD);
});

test("소셜 버튼은 Google, Apple, Facebook 순서로 signIn.sso를 부른다", async () => {
  const user = userEvent.setup();
  render(<SocialButtons redirectUrl="/analyses" />);
  const names = screen.getAllByRole("button").map((b) => b.textContent);
  expect(names).toEqual(["Google로 계속하기", "Apple로 계속하기", "Facebook으로 계속하기"]);

  for (const [name, strategy] of [
    ["Google로 계속하기", "oauth_google"],
    ["Apple로 계속하기", "oauth_apple"],
    ["Facebook으로 계속하기", "oauth_facebook"],
  ]) {
    await user.click(screen.getByRole("button", { name }));
    expect(m.signIn.sso).toHaveBeenLastCalledWith({
      strategy,
      redirectCallbackUrl: "/sso-callback",
      redirectUrl: "/analyses",
    });
  }
});

test("Clerk 영어 오류를 한국어 문구로 바꾼다", () => {
  expect(clerkMessage({ code: "form_identifier_exists", message: "That email address is taken." })).toMatch(/이미 가입/);
  expect(clerkMessage({ code: "form_code_incorrect", message: "Incorrect code" })).toMatch(/코드/);
  expect(clerkMessage({ code: "form_password_length_too_short", message: "x" })).toMatch(/15자/);
  const unknown = clerkMessage({ code: "something_new", message: "English only text" });
  expect(unknown).not.toMatch(/English/);
  expect(unknown).toMatch(/[가-힣]/);
});

test("redirect_url은 사이트 내부 경로만 허용한다", () => {
  expect(safeRedirect("/analyses/new?x=1")).toBe("/analyses/new?x=1");
  for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "evil", "", undefined, null]) {
    expect(safeRedirect(bad)).toBe("/");
  }
});

test("프로필 이름 변경에 실패하면 입력값을 유지한다", async () => {
  const user = userEvent.setup();
  m.user.update.mockRejectedValueOnce({ errors: [{ code: "form_param_format_invalid", message: "bad" }] });
  render(<AccountPanel />);
  const input = screen.getByLabelText("이름") as HTMLInputElement;
  await user.clear(input);
  await user.type(input, "김철수");
  await user.click(screen.getByRole("button", { name: "이름 저장" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(input.value).toBe("김철수");

  await user.click(screen.getByRole("button", { name: "이름 저장" }));
  expect(m.user.update).toHaveBeenLastCalledWith({ firstName: "김철수", lastName: "" });
  expect(await screen.findByText("저장했습니다.")).toBeTruthy();
});

test("탈퇴는 확인 문구를 입력해야 실행된다", async () => {
  const user = userEvent.setup();
  render(<AccountPanel />);
  const button = screen.getByRole("button", { name: "회원 탈퇴" }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);

  fireEvent.change(screen.getByLabelText(/확인 문구/), { target: { value: "탈퇴 안함" } });
  expect(button.disabled).toBe(true);

  fireEvent.change(screen.getByLabelText(/확인 문구/), { target: { value: "탈퇴합니다" } });
  expect(button.disabled).toBe(false);
  await user.click(button);

  expect(m.request).toHaveBeenCalledWith("/api/v1/me", { method: "DELETE" });
  await waitFor(() => expect(m.signOut).toHaveBeenCalledWith({ redirectUrl: "/" }));
  expect(m.request.mock.invocationCallOrder[0]).toBeLessThan(m.signOut.mock.invocationCallOrder[0]);
});

test("탈퇴 API가 실패하면 로그아웃하지 않는다", async () => {
  const user = userEvent.setup();
  m.request.mockRejectedValueOnce(new Error("boom"));
  render(<AccountPanel />);
  fireEvent.change(screen.getByLabelText(/확인 문구/), { target: { value: "탈퇴합니다" } });
  await user.click(screen.getByRole("button", { name: "회원 탈퇴" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(m.signOut).not.toHaveBeenCalled();
});
