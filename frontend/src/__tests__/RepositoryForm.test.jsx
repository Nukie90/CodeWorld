import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import GitHubUploadPage from "../pages/GitHubUploadPage";
import { useGithubAuth } from "../hooks/useGithubAuth";
import { authService, repoService } from "../services/api";

const mockNavigate = jest.fn();

jest.mock("../hooks/useGithubAuth");
jest.mock("../services/api", () => ({
  authService: {
    getRepos: jest.fn(),
  },
  repoService: {
    analyzeRepo: jest.fn(),
  },
}));
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

describe("Repository form", () => {
  beforeEach(() => {
    authService.getRepos.mockResolvedValue({ data: [] });
  });

  test("submits a valid repository and navigates to results", async () => {
    const setStatusMessage = jest.fn();

    useGithubAuth.mockReturnValue({
      token: "frontend-token",
      username: "qa-user",
      statusMessage: "",
      setStatusMessage,
      login: jest.fn(),
      logout: jest.fn(),
    });

    repoService.analyzeRepo.mockResolvedValue({
      data: {
        repo_url: "https://github.com/Nukie90/CodeWorld.git",
        analysis: {
          folder_metrics: {
            total_files: 2,
            total_loc: 20,
            total_lloc: 12,
            total_functions: 3,
            total_complexity: 5,
          },
          individual_files: [],
        },
      },
    });

    render(
      <MemoryRouter>
        <GitHubUploadPage />
      </MemoryRouter>
    );

    await userEvent.type(
      screen.getByPlaceholderText(/enter github repository url/i),
      "https://github.com/Nukie90/CodeWorld.git"
    );
    await userEvent.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(repoService.analyzeRepo).toHaveBeenCalledWith({
        repo_url: "https://github.com/Nukie90/CodeWorld.git",
        token: "frontend-token",
        task_id: expect.any(String),
      });
    });

    expect(setStatusMessage).toHaveBeenCalledWith("Initializing analysis...");
    expect(mockNavigate).toHaveBeenCalledWith("/results", {
      state: {
        analysisResult: expect.objectContaining({
          repo_url: "https://github.com/Nukie90/CodeWorld.git",
        }),
        token: "frontend-token",
        username: "qa-user",
      },
    });
  });

  test("shows backend validation error for an invalid repository value", async () => {
    const setStatusMessage = jest.fn();

    useGithubAuth.mockReturnValue({
      token: "frontend-token",
      username: "qa-user",
      statusMessage: "",
      setStatusMessage,
      login: jest.fn(),
      logout: jest.fn(),
    });

    repoService.analyzeRepo.mockRejectedValue({
      response: {
        data: {
          detail: "Invalid repository specification: 'not-a-repo'",
        },
      },
    });

    render(
      <MemoryRouter>
        <GitHubUploadPage />
      </MemoryRouter>
    );

    await userEvent.type(
      screen.getByPlaceholderText(/enter github repository url/i),
      "not-a-repo"
    );
    await userEvent.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(setStatusMessage).toHaveBeenCalledWith(
        "Invalid repository specification: 'not-a-repo'"
      );
    });
  });
});
