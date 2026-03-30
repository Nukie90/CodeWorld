const { test, expect } = require("@playwright/test");

async function seedAuthenticatedSession(page) {
  await page.addInitScript(() => {
    localStorage.setItem("access_token", "e2e-token");
    localStorage.setItem("username", "e2e-user");
  });
}

async function waitForVisualizationReady(page) {
  await expect(page.getByRole("button", { name: /type/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /bar chart/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /island 3d/i })).toBeVisible();

  const islandSignals = [
    page.getByPlaceholder("Search file name...").waitFor({ state: "visible", timeout: 5000 }),
    page.getByText(/3D visualization is unavailable in this environment/i).waitFor({
      state: "visible",
      timeout: 5000,
    }),
  ];

  await Promise.any(islandSignals);
}

async function mockApplicationApis(page, { analysisFails = false } = {}) {
  const mainAnalysis = {
    repo_url: "https://github.com/Nukie90/CodeWorld.git",
    folder_name: "/tmp/CodeWorld",
    analysis: {
      folder_metrics: {
        folder_name: "CodeWorld",
        total_files: 2,
        total_loc: 20,
        total_lloc: 12,
        total_functions: 2,
        total_complexity: 5,
      },
      individual_files: [
        {
          filename: "src/App.jsx",
          total_loc: 10,
          total_lloc: 6,
          function_count: 1,
          total_complexity: 3,
          total_cognitive_complexity: 6,
          maintainability_index: 82.5,
          functions: [
            {
              name: "renderApp",
              long_name: "renderApp",
              start_line: 1,
              end_line: 6,
              lloc: 6,
              cognitive_complexity: 3,
              cyclomatic_complexity: 2,
              total_cognitive_complexity: 3,
              maintainability_index: 82.5,
              max_nesting_depth: 1,
              halstead_volume: 30,
              children: [],
            },
          ],
        },
        {
          filename: "src/utils.js",
          total_loc: 10,
          total_lloc: 6,
          function_count: 1,
          total_complexity: 2,
          total_cognitive_complexity: 2,
          maintainability_index: 91.0,
          functions: [
            {
              name: "formatName",
              long_name: "formatName",
              start_line: 1,
              end_line: 4,
              lloc: 4,
              cognitive_complexity: 1,
              cyclomatic_complexity: 1,
              total_cognitive_complexity: 1,
              maintainability_index: 91.0,
              max_nesting_depth: 1,
              halstead_volume: 12,
              children: [],
            },
          ],
        },
      ],
    },
  };

  const refactorAnalysis = {
    repo_url: "https://github.com/Nukie90/CodeWorld.git",
    folder_name: "/tmp/CodeWorld",
    analysis: {
      folder_metrics: {
        folder_name: "CodeWorld",
        total_files: 3,
        total_loc: 28,
        total_lloc: 18,
        total_functions: 3,
        total_complexity: 7,
      },
      individual_files: [
        ...mainAnalysis.analysis.individual_files,
        {
          filename: "src/refactor.js",
          total_loc: 8,
          total_lloc: 6,
          function_count: 1,
          total_complexity: 2,
          total_cognitive_complexity: 3,
          maintainability_index: 88.0,
          functions: [
            {
              name: "refactorFlow",
              long_name: "refactorFlow",
              start_line: 1,
              end_line: 5,
              lloc: 5,
              cognitive_complexity: 2,
              cyclomatic_complexity: 2,
              total_cognitive_complexity: 2,
              maintainability_index: 88.0,
              max_nesting_depth: 1,
              halstead_volume: 18,
              children: [],
            },
          ],
        },
      ],
    },
  };

  await page.route("**/api/auth/github/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        auth_url: "http://127.0.0.1:4173/?token=e2e-token&username=e2e-user",
      }),
    });
  });

  await page.route("**/api/auth/github/repos**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: 1,
          name: "CodeWorld",
          full_name: "Nukie90/CodeWorld",
          html_url: "https://github.com/Nukie90/CodeWorld.git",
          description: "CodeWorld repository",
          language: "JavaScript",
          stargazers_count: 5,
          updated_at: "2026-03-29T10:00:00Z",
          private: false,
          owner: "example",
        },
      ]),
    });
  });

  await page.route("**/api/analyze/progress/test-task-id", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: 'data: {"progress":100,"message":"Analysis complete","done":true}\n\n',
    });
  });

  await page.route("**/api/analyze/repo", async (route) => {
    if (analysisFails) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Analyzer service unavailable" }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mainAnalysis),
    });
  });

  await page.route("**/api/repo/branches**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        current: "main",
        local: ["main"],
        remote: ["origin/main", "origin/refactor"],
      }),
    });
  });

  await page.route("**/api/repo/checkout", async (route) => {
    const request = route.request();
    const body = request.postDataJSON();
    const branch = body?.branch;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(branch === "origin/refactor" ? refactorAnalysis : mainAnalysis),
    });
  });

  await page.route("**/api/repo/function-code", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        filename: "src/App.jsx",
        function_name: "renderApp",
        start_line: 1,
        end_line: 6,
        code: "function renderApp() {\n  return <App />;\n}",
      }),
    });
  });

  await page.route("**/api/lint/src/App.jsx", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        lint_score: 85,
        lint_errors: [
          {
            type: "warning",
            line: 1,
            column: 1,
            module: "src/App.jsx",
            obj: "renderApp",
            path: "src/App.jsx",
            symbol: "no-console",
            message: "Unexpected console statement.",
            message_id: "no-console",
          },
        ],
      }),
    });
  });
}

test("Login and reach dashboard", async ({ page }) => {
  await mockApplicationApis(page);

  await page.goto("/");
  await page.getByRole("button", { name: /login with github/i }).click();

  await expect(page.getByText("@e2e-user")).toBeVisible();
  await expect(page.getByRole("button", { name: /logout/i })).toBeVisible();
});

test("Submit repository and view analysis results", async ({ page }) => {
  await seedAuthenticatedSession(page);
  await mockApplicationApis(page);

  await page.goto("/");
  await page.getByPlaceholder("Enter GitHub repository URL").fill(
    "https://github.com/Nukie90/CodeWorld.git"
  );
  await page.getByRole("button", { name: /next/i }).click();

  await page.waitForURL("**/results");
  await waitForVisualizationReady(page);
  await expect(page.getByText(/showing/i)).toBeVisible();
  await expect(page.getByText(/2 of 2 files/i)).toBeVisible();
});

test("Open source code view from analysis results", async ({ page }) => {
  await seedAuthenticatedSession(page);
  await mockApplicationApis(page);

  await page.goto("/");
  await page.getByPlaceholder("Enter GitHub repository URL").fill(
    "https://github.com/Nukie90/CodeWorld.git"
  );
  await page.getByRole("button", { name: /next/i }).click();
  await page.waitForURL("**/results");
  await waitForVisualizationReady(page);

  await page.getByRole("button", { name: /type/i }).click();
  await page.getByRole("button", { name: /bar chart/i }).click();
  await page.locator('div[style*="background-color"]').first().dispatchEvent("click");

  await expect(page.getByText(/raw code/i)).toBeVisible();
  await expect(page.getByText(/^renderApp$/)).toBeVisible();
});

test("Switch source code display mode and show lint suggestions", async ({ page }) => {
  await seedAuthenticatedSession(page);
  await mockApplicationApis(page);

  await page.goto("/");
  await page.getByPlaceholder("Enter GitHub repository URL").fill(
    "https://github.com/Nukie90/CodeWorld.git"
  );
  await page.getByRole("button", { name: /next/i }).click();
  await page.waitForURL("**/results");
  await waitForVisualizationReady(page);

  await page.getByRole("button", { name: /type/i }).click();
  await page.getByRole("button", { name: /bar chart/i }).click();
  await page.locator('div[style*="background-color"]').first().dispatchEvent("click");

  await expect(page.getByText(/^renderApp$/)).toBeVisible();
  await page.getByRole("button", { name: /plain/i }).click();
  await page.getByRole("button", { name: /highlighted/i }).click();
  await page.getByRole("button", { name: /linter suggest/i }).click();

  await expect(page.getByText(/no-console/i)).toBeVisible();
});

test("Handle repository analysis failure gracefully", async ({ page }) => {
  await seedAuthenticatedSession(page);
  await mockApplicationApis(page, { analysisFails: true });

  await page.goto("/");
  await page.getByPlaceholder("Enter GitHub repository URL").fill(
    "https://github.com/example/broken-repo"
  );
  await page.getByRole("button", { name: /next/i }).click();

  await expect(page.getByText(/analyzer service unavailable/i)).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("Switch branch to origin/refactor and update analysis results", async ({ page }) => {
  await seedAuthenticatedSession(page);
  await mockApplicationApis(page);

  await page.goto("/");
  await page.getByPlaceholder("Enter GitHub repository URL").fill(
    "https://github.com/Nukie90/CodeWorld.git"
  );
  await page.getByRole("button", { name: /next/i }).click();
  await page.waitForURL("**/results");
  await waitForVisualizationReady(page);

  const branchSelect = page.locator("select").first();
  await expect(branchSelect).toBeVisible();
  await expect(branchSelect.locator("option")).toContainText([
    "Select branch",
    "main",
    "origin/main",
    "origin/refactor",
  ]);
  await branchSelect.selectOption({ label: "origin/refactor" });

  await expect(branchSelect).toHaveValue("origin/refactor");
  await expect(page.getByText(/showing/i)).toBeVisible();
  await expect(page.getByText(/3 of 3 files/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /project metrics/i })).toBeVisible();
});
