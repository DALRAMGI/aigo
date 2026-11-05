import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const PRODUCTS = {
  items: [
    {
      slug: "dashpi-standard",
      name: "DashPi 스탠다드",
      description: "기본 구성입니다.",
      price: 129000,
      specs: {},
      image_url: "/products/dashpi.webp",
    },
    {
      slug: "dashpi-pro",
      name: "DashPi 프로",
      description: "확장 구성입니다.",
      price: 189000,
      specs: {},
      image_url: "/products/dashpi.webp",
    },
  ],
  total: 2,
};

const mockProducts = (page: Page, status = 200) =>
  page.route("**/api/v1/products*", (route) =>
    status === 200
      ? route.fulfill({ json: PRODUCTS })
      : route.fulfill({ status, json: { code: "INTERNAL_ERROR", message: "서버 오류" } }),
  );

const usePoster = (context: BrowserContext, baseURL?: string) =>
  context.addCookies([{ name: "aigo-design", value: "poster", url: baseURL! }]);

const designCookie = async (context: BrowserContext) =>
  (await context.cookies()).find((c) => c.name === "aigo-design");

const design = (page: Page) => page.locator("html").getAttribute("data-design");

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("토글로 바꾸면 다른 화면과 새로고침에도 유지되고 다시 되돌린다", async ({ page, context }) => {
  await mockProducts(page);
  await page.goto("/");
  expect(await design(page)).toBe("classic");

  await page.getByRole("button", { name: "포스터 디자인으로 전환" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-design", "poster");
  await expect(page.locator("h1")).toContainText("사고를");
  const cookie = await designCookie(context);
  expect(cookie?.value).toBe("poster");
  expect(cookie!.expires - Date.now() / 1000).toBeGreaterThan(364 * 86400);

  await page.reload();
  await expect(page.locator("h1")).toContainText("읽다");
  await page.goto("/login");
  expect(await design(page)).toBe("poster");

  await page.goto("/");
  await page.getByRole("button", { name: "기본 디자인으로 전환" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-design", "classic");
  await expect(page.locator("h1")).toContainText("사고를 판정하는 AI가 아니라");
});

test("서버가 첫 HTML부터 data-design을 내려 깜빡이지 않는다", async ({ request }) => {
  const res = await request.get("/login", { headers: { cookie: "aigo-design=poster" } });
  expect(await res.text()).toMatch(/<html[^>]*data-design="poster"/);
});

test("잘못된 쿠키는 classic으로 읽는다", async ({ request }) => {
  const res = await request.get("/login", { headers: { cookie: "aigo-design=neon" } });
  expect(await res.text()).toMatch(/<html[^>]*data-design="classic"/);
});

test("?design=poster로 열면 쿠키를 쓰고 파라미터 없는 주소로 간다", async ({ page, context }) => {
  await mockProducts(page);
  await page.goto("/?design=poster");
  expect(new URL(page.url()).search).toBe("");
  expect((await designCookie(context))?.value).toBe("poster");
  await expect(page.locator("#report")).toContainText("영상 기반 AI 추정이며 법적 판단이 아닙니다");

  await page.goto("/?design=classic");
  expect(new URL(page.url()).search).toBe("");
  expect(await design(page)).toBe("classic");
});

test("다른 파라미터는 남기고 공개 경로에서 동작한다", async ({ page }) => {
  await page.goto("/login?design=poster&redirect_url=%2Faccount");
  expect(new URL(page.url()).search).toBe("?redirect_url=%2Faccount");
  expect(await design(page)).toBe("poster");
});

test("다른 값은 무시한다", async ({ page, context }) => {
  await mockProducts(page);
  await page.goto("/?design=neon");
  expect(new URL(page.url()).search).toBe("?design=neon");
  expect(await designCookie(context)).toBeUndefined();
  expect(await design(page)).toBe("classic");
});

test("디자인 리다이렉트도 전달 헤더의 공개 주소를 쓴다", async ({ request }) => {
  const res = await request.get("/?design=poster", {
    maxRedirects: 0,
    headers: { "x-forwarded-host": "aigo.example", "x-forwarded-proto": "https" },
  });
  expect(res.status()).toBe(307);
  expect(res.headers().location).toBe("https://aigo.example/");
  expect(res.headers()["set-cookie"]).toContain("aigo-design=poster");
});

test("보호 경로는 design 파라미터가 있어도 로그인으로 보낸다", async ({ request }) => {
  const res = await request.get("/analyses?design=poster", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers().location).toContain("/login?redirect_url=%2Fanalyses%3Fdesign%3Dposter");
  expect(res.headers()["set-cookie"] ?? "").not.toContain("aigo-design");
});

test("포스터에서도 보호 경로 진입은 로그인으로 간다", async ({ page, context, baseURL }) => {
  await usePoster(context, baseURL);
  await mockProducts(page);
  await page.goto("/");
  await page.locator("#hero").getByRole("link", { name: "사고 영상 분석하기" }).click();
  await page.waitForURL((url) => url.pathname === "/login");
  expect(decodeURIComponent(page.url())).toContain("/analyses/new");
});

test("상품은 API에서 받아 상세로 연결한다", async ({ page, context, baseURL }) => {
  await usePoster(context, baseURL);
  await mockProducts(page);
  await page.goto("/");
  const link = page.locator("#products").getByRole("link", { name: /DashPi 프로/ });
  await expect(link).toHaveAttribute("href", "/products/dashpi-pro");
  await expect(link).toContainText("189,000원");
  await page.locator("#hero").getByRole("link", { name: "DashPi 보기" }).click();
  await expect(page.locator("#products")).toBeInViewport();
});

test("상품 API가 실패하면 재시도 화면을 보여 주고 복구한다", async ({ page, context, baseURL }) => {
  await usePoster(context, baseURL);
  await mockProducts(page, 500);
  await page.goto("/");
  const products = page.locator("#products");
  await expect(products.getByRole("alert")).toContainText("상품 정보를 불러오지 못했습니다");
  await expect(page.locator("#cta")).toBeAttached();

  await page.unroute("**/api/v1/products*");
  await mockProducts(page);
  await products.getByRole("button", { name: "다시 시도" }).click();
  await expect(products.getByRole("link", { name: /DashPi 스탠다드/ })).toBeVisible();
});

for (const width of [360, 1440]) {
  test(`${width}px에서 가로 스크롤이 없다`, async ({ page, context, baseURL }) => {
    await usePoster(context, baseURL);
    await mockProducts(page);
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await expect(page.locator("#products").getByRole("link", { name: /DashPi 프로/ })).toBeAttached();
    expect(await overflow(page)).toBe(0);
  });
}

test("360px에서도 토글을 누를 수 있다", async ({ page, context, baseURL }) => {
  await usePoster(context, baseURL);
  await mockProducts(page);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  await page.getByRole("button", { name: "기본 디자인으로 전환" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-design", "classic");
});

test("움직임이 있고 reduced-motion이면 끄고 숫자는 최종값이다", async ({ page, context, baseURL }) => {
  await usePoster(context, baseURL);
  await mockProducts(page);
  const running = () => page.locator("#hero").evaluate((el) => el.getAnimations({ subtree: true }).length);

  await page.goto("/");
  await expect(page.locator("#hero")).toBeVisible();
  expect(await running()).toBeGreaterThan(0);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(page.locator("#hero")).toBeVisible();
  expect(await running()).toBe(0);
  await expect(page.locator("#story")).toContainText("7.4");
  await expect(page.locator("#report")).toContainText("20~30");
  await expect(page.locator('#story [data-reveal="wait"]')).toHaveCount(0);
});

test("테마 버튼이 포스터 값 안에서 다크로 바꾼다", async ({ page, context, baseURL }) => {
  await usePoster(context, baseURL);
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/login");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(243, 243, 239)");
  await page.getByRole("button", { name: "다크 모드로 전환" }).click();
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(10, 13, 61)");
});

test("스크롤해도 Nav가 위에 붙어 있다", async ({ page, context, baseURL }) => {
  await usePoster(context, baseURL);
  await mockProducts(page);
  await page.goto("/");
  await page.evaluate(() => scrollTo(0, 2000));
  await expect
    .poll(() => page.getByRole("navigation", { name: "주 메뉴" }).evaluate((el) => el.getBoundingClientRect().top))
    .toBe(0);
});

test("사고 영상과 프레임이 없다", async ({ page, context, baseURL }) => {
  await usePoster(context, baseURL);
  await mockProducts(page);
  await page.goto("/");
  await expect(page.locator("main video, #hero img, #story img, #report img")).toHaveCount(0);
});
