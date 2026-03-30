import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ResultsPage from "../pages/ResultsPage";
import { repoService } from "../services/api";
import { useRepoBranches } from "../hooks/useRepoBranches";
import { useRepoAnimation } from "../hooks/useRepoAnimation";

const analysisResult = {
  repo_url: "https://github.com/Nukie90/CodeWorld.git",
  analysis: {
    folder_metrics: {
      total_files: 2,
      total_loc: 20,
      total_lloc: 12,
      total_functions: 3,
      total_complexity: 5,
    },
    individual_files: [
      {
        filename: "src/App.jsx",
        total_cognitive_complexity: 10,
        functions: [
          {
            name: "renderApp",
            start_line: 1,
            lloc: 6,
            cognitive_complexity: 3,
            cyclomatic_complexity: 2,
          },
        ],
      },
      {
        filename: "src/utils.js",
        total_cognitive_complexity: 4,
        functions: [],
      },
    ],
  },
};

jest.mock("../services/api", () => ({
  repoService: {
    getFunctionCode: jest.fn(),
    lintFile: jest.fn(),
  },
}));
jest.mock("../hooks/useRepoBranches");
jest.mock("../hooks/useRepoAnimation");
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => jest.fn(),
  useLocation: () => ({
    state: {
      analysisResult,
      token: "frontend-token",
      username: "qa-user",
    },
  }),
}));
jest.mock("../components/features/results/ResultsControlBar", () => () => (
  <div>ResultsControlBar</div>
));
jest.mock("../components/features/results/ResultsSidebar", () => (props) => (
  <div>
    {props.branchLoading ? "Loading repository data..." : "Repository ready"}
    <div>{`Showing ${props.filteredFiles.length} of ${props.individual_files.length} files`}</div>
  </div>
));
jest.mock("../components/features/results/ResultsDetailsPanel", () => (props) => (
  <div>
    <div>{`Total files: ${props.folderSummary["Total files"] ?? "n/a"}`}</div>
    <div>{`Total lines: ${props.folderSummary["Total lines"] ?? "n/a"}`}</div>
    {props.codeLoading && <div>Loading code...</div>}
    {props.selectedCode && <pre>{props.selectedCode.code}</pre>}
  </div>
));
jest.mock("../components/features/visualizations/Island3DVisualization", () => (props) => (
  <button
    onClick={() =>
      props.onFunctionClick({
        filename: "src/App.jsx",
        functionName: "renderApp",
        startLine: 1,
        lloc: 6,
      })
    }
  >
    Open function code
  </button>
));
jest.mock("../components/features/visualizations/BarChartVisualization", () => () => (
  <div>Bar Chart</div>
));
jest.mock("../components/features/git_graph/CommitDetailModal", () => () => null);

describe("Results dashboard", () => {
  beforeEach(() => {
    useRepoBranches.mockReturnValue({
      branches: ["main"],
      currentBranch: "main",
      branchLoading: false,
      handleBranchChange: jest.fn(),
    });

    useRepoAnimation.mockReturnValue({
      isAnimating: false,
      animationProgress: 0,
      animatingCommit: null,
      allCommits: [],
      currentCommitIndex: -1,
      animationSpeed: 400,
      setAnimationSpeed: jest.fn(),
      fixedFileOrder: null,
      handlePlayAnimation: jest.fn(),
      handlePlayFromDate: jest.fn(),
      handleStepPrev: jest.fn(),
      handleStepNext: jest.fn(),
      handleCommitClick: jest.fn(),
    });
  });

  test("renders key metrics from the analysis payload", () => {
    render(<ResultsPage />);

    expect(screen.getByText("Total files: 2")).toBeInTheDocument();
    expect(screen.getByText("Total lines: 20")).toBeInTheDocument();
    expect(screen.getByText("Showing 2 of 2 files")).toBeInTheDocument();
  });

  test("shows a loading state while source code is being fetched", async () => {
    let resolveRequest;
    repoService.getFunctionCode.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      })
    );

    render(<ResultsPage />);

    await userEvent.click(screen.getByRole("button", { name: /open function code/i }));
    expect(screen.getByText(/loading code/i)).toBeInTheDocument();

    resolveRequest({
      data: {
        filename: "src/App.jsx",
        function_name: "renderApp",
        start_line: 1,
        end_line: 6,
        code: "function renderApp() {}",
      },
    });

    await waitFor(() => {
      expect(screen.getByText(/function renderApp/i)).toBeInTheDocument();
    });
  });

  test("remains stable when the source code API request fails", async () => {
    repoService.getFunctionCode.mockRejectedValue(new Error("API failure"));

    render(<ResultsPage />);

    await userEvent.click(screen.getByRole("button", { name: /open function code/i }));

    await waitFor(() => {
      expect(screen.queryByText(/loading code/i)).not.toBeInTheDocument();
    });
  });
});
