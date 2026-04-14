import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ResultsDetailsPanel from "../components/features/results/ResultsDetailsPanel";

jest.mock("../components/features/results/visualizations/LintScoreGauge", () => () => (
  <div>LintScoreGauge</div>
));
jest.mock("../components/features/results/visualizations/LintErrorDistribution", () => () => (
  <div>LintErrorDistribution</div>
));

function renderPanel(overrides = {}) {
  const props = {
    isDarkMode: false,
    isRightPanelOpen: true,
    setIsRightPanelOpen: jest.fn(),
    rightPanelWidth: 420,
    isDragging: false,
    startResizingRight: jest.fn(),
    selectedCode: {
      filename: "src/App.jsx",
      functionName: "renderApp",
      startLine: 1,
      endLine: 6,
      code: "function renderApp() {\n  return <App />;\n}",
    },
    codeDisplayMode: "highlighted",
    setCodeDisplayMode: jest.fn(),
    showLineNumbers: false,
    setShowLineNumbers: jest.fn(),
    handleCopyCode: jest.fn(),
    copied: false,
    codeLoading: false,
    selectedFileForCard: null,
    rightPanelTab: "summary",
    setRightPanelTab: jest.fn(),
    folderSummary: {},
    individual_files: [],
    handleFunctionClick: jest.fn(),
    isBottomPanelOpen: false,
    setIsBottomPanelOpen: jest.fn(),
    setIsLeftPanelOpen: jest.fn(),
    lintResults: {
      lint_score: 88,
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
    },
    isLinting: false,
    handleLintFile: jest.fn(),
    ...overrides,
  };

  render(<ResultsDetailsPanel {...props} />);
  return props;
}

describe("Source code viewer", () => {
  test("plain text mode can be selected", async () => {
    const props = renderPanel();

    await userEvent.click(screen.getByRole("button", { name: /plain/i }));

    expect(props.setCodeDisplayMode).toHaveBeenCalledWith("plain");
  });

  test("syntax-highlighted mode can be selected", async () => {
    const props = renderPanel({ codeDisplayMode: "plain" });

    await userEvent.click(screen.getByRole("button", { name: /highlighted/i }));

    expect(props.setCodeDisplayMode).toHaveBeenCalledWith("highlighted");
  });

  test("lint suggestion mode triggers lint loading for the selected file", async () => {
    const props = renderPanel();

    await userEvent.click(screen.getByRole("button", { name: /linter suggest/i }));

    expect(props.setCodeDisplayMode).toHaveBeenCalledWith("linterSuggest");
    expect(props.handleLintFile).toHaveBeenCalledWith("src/App.jsx");
  });
});
