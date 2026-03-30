import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ResultsSidebar from "../components/features/results/ResultsSidebar";

jest.mock("../components/features/git_graph/GitGraph", () => () => <div>GitGraph</div>);

function renderSidebar(overrides = {}) {
  const props = {
    isDarkMode: false,
    isLeftPanelOpen: true,
    setIsLeftPanelOpen: jest.fn(),
    leftPanelWidth: 360,
    isDragging: false,
    startResizingLeft: jest.fn(),
    currentBranch: "main",
    branches: ["main", "origin/refactor"],
    branchLoading: false,
    handleBranchChange: jest.fn(),
    topNComplexity: "All",
    isCustomMode: false,
    setTopNComplexity: jest.fn(),
    setIsCustomMode: jest.fn(),
    selectedDirectory: "All",
    setSelectedDirectory: jest.fn(),
    availableDirectories: ["All", "src"],
    filteredFiles: [{ filename: "src/App.jsx" }, { filename: "src/utils.js" }],
    individual_files: [{ filename: "src/App.jsx" }, { filename: "src/utils.js" }],
    handleStepPrev: jest.fn(),
    handleStepNext: jest.fn(),
    handlePlayAnimation: jest.fn(),
    isAnimating: false,
    animationSpeed: 1200,
    setAnimationSpeed: jest.fn(),
    handlePlayFromDate: jest.fn(),
    showContributors: false,
    setShowContributors: jest.fn(),
    animatingCommit: null,
    setSelectedCommitForModal: jest.fn(),
    animationProgress: 0,
    formatCommitDate: jest.fn(),
    analysisResult: { repo_url: "https://github.com/Nukie90/CodeWorld.git" },
    token: "token",
    handleCommitClick: jest.fn(),
    allCommits: [],
    setIsBottomPanelOpen: jest.fn(),
    currentCommitIndex: 0,
    ...overrides,
  };

  render(<ResultsSidebar {...props} />);
  return props;
}

describe("ResultsSidebar", () => {
  test("renders branch options including origin/refactor and forwards selection", async () => {
    const props = renderSidebar();

    const branchSelect = screen.getByDisplayValue("main");
    expect(branchSelect).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "origin/refactor" })).toBeInTheDocument();

    await userEvent.selectOptions(branchSelect, "origin/refactor");

    expect(props.handleBranchChange).toHaveBeenCalled();
  });

  test("disables branch and playback controls when no branches are available", () => {
    renderSidebar({
      branches: [],
      currentBranch: "",
    });

    const selects = screen.getAllByRole("combobox");
    expect(selects[0]).toBeDisabled();
    expect(screen.getByTitle(/play evolution animation/i)).toBeDisabled();
  });

  test("disables previous and next commit buttons at timeline boundaries", () => {
    renderSidebar({
      allCommits: [{ hash: "a" }, { hash: "b" }],
      currentCommitIndex: 0,
    });

    expect(screen.getByTitle(/previous commit/i)).toBeDisabled();
    expect(screen.getByTitle(/next commit/i)).not.toBeDisabled();
  });

  test("passes timeline start boundary values to the playback handler", async () => {
    const props = renderSidebar();
    const selects = screen.getAllByRole("combobox");
    const startTimelineSelect = selects[3];

    await userEvent.selectOptions(startTimelineSelect, "all");
    expect(props.handlePlayFromDate).toHaveBeenCalledWith("all");

    fireEvent.change(startTimelineSelect, { target: { value: "0" } });
    expect(props.handlePlayFromDate).toHaveBeenCalledWith(0);
  });

  test("switches to custom top complexity mode", async () => {
    const props = renderSidebar({
      isCustomMode: false,
      topNComplexity: "All",
    });

    const selects = screen.getAllByRole("combobox");
    const topComplexitySelect = selects[1];

    await userEvent.selectOptions(topComplexitySelect, "Custom");

    expect(props.setIsCustomMode).toHaveBeenCalledWith(true);
    expect(props.setTopNComplexity).toHaveBeenCalledWith("500");
  });
});
