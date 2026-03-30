import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useRepoBranches } from "../hooks/useRepoBranches";
import { repoService } from "../services/api";

jest.mock("../services/api", () => ({
  repoService: {
    getBranches: jest.fn(),
    checkout: jest.fn(),
  },
}));

function HookHarness({ repoUrl = "https://github.com/Nukie90/CodeWorld.git", token = "token" }) {
  const setAnalysisResult = React.useRef(jest.fn()).current;
  const { branches, currentBranch, branchLoading, handleBranchChange } = useRepoBranches(
    repoUrl,
    token,
    null,
    setAnalysisResult
  );

  return (
    <div>
      <div data-testid="branches">{branches.join(",")}</div>
      <div data-testid="current-branch">{currentBranch}</div>
      <div data-testid="loading-state">{String(branchLoading)}</div>
      <button
        onClick={() => handleBranchChange({ target: { value: "origin/refactor" } })}
      >
        Switch Branch
      </button>
      <button
        onClick={() => handleBranchChange({ target: { value: "" } })}
      >
        Empty Branch
      </button>
      <div data-testid="set-analysis-called">
        {String(setAnalysisResult.mock.calls.length)}
      </div>
    </div>
  );
}

describe("useRepoBranches", () => {
  test("fetches and merges unique local and remote branches", async () => {
    repoService.getBranches.mockResolvedValue({
      data: {
        current: "main",
        local: ["main"],
        remote: ["origin/main", "origin/refactor"],
      },
    });

    render(<HookHarness />);

    await waitFor(() => {
      expect(screen.getByTestId("current-branch")).toHaveTextContent("main");
    });
    expect(screen.getByTestId("branches")).toHaveTextContent(
      "main,origin/main,origin/refactor"
    );
  });

  test("updates branch and analysis state on successful checkout", async () => {
    repoService.getBranches.mockResolvedValue({
      data: {
        current: "main",
        local: ["main"],
        remote: ["origin/refactor"],
      },
    });
    repoService.checkout.mockResolvedValue({
      data: {
        analysis: { folder_metrics: { total_files: 3 } },
      },
    });

    render(<HookHarness />);

    await waitFor(() => {
      expect(screen.getByTestId("current-branch")).toHaveTextContent("main");
    });
    await userEvent.click(screen.getByRole("button", { name: /switch branch/i }));

    await waitFor(() => {
      expect(repoService.checkout).toHaveBeenCalledWith(
        "https://github.com/Nukie90/CodeWorld.git",
        "origin/refactor",
        "token"
      );
    });

    expect(screen.getByTestId("current-branch")).toHaveTextContent("origin/refactor");
    expect(screen.getByTestId("set-analysis-called")).toHaveTextContent("1");
    expect(screen.getByTestId("loading-state")).toHaveTextContent("false");
  });

  test("does not checkout when branch value is empty", async () => {
    repoService.getBranches.mockResolvedValue({
      data: {
        current: "main",
        local: ["main"],
        remote: [],
      },
    });

    render(<HookHarness />);

    await waitFor(() => {
      expect(screen.getByTestId("current-branch")).toHaveTextContent("main");
    });
    await userEvent.click(screen.getByRole("button", { name: /empty branch/i }));

    expect(repoService.checkout).not.toHaveBeenCalled();
    expect(screen.getByTestId("current-branch")).toHaveTextContent("main");
  });

  test("resets loading state when checkout fails", async () => {
    repoService.getBranches.mockResolvedValue({
      data: {
        current: "main",
        local: ["main"],
        remote: ["origin/refactor"],
      },
    });
    repoService.checkout.mockRejectedValue(new Error("Checkout failed"));

    render(<HookHarness />);

    await waitFor(() => {
      expect(screen.getByTestId("current-branch")).toHaveTextContent("main");
    });
    await userEvent.click(screen.getByRole("button", { name: /switch branch/i }));

    await waitFor(() => {
      expect(screen.getByTestId("loading-state")).toHaveTextContent("false");
    });

    expect(screen.getByTestId("current-branch")).toHaveTextContent("main");
    expect(screen.getByTestId("set-analysis-called")).toHaveTextContent("0");
  });
});
