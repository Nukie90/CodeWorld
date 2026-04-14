import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import GitHubUploadPage from "../pages/GitHubUploadPage";
import { useGithubAuth } from "../hooks/useGithubAuth";
import { authService } from "../services/api";

jest.mock("../hooks/useGithubAuth");
jest.mock("../services/api", () => ({
  authService: {
    getRepos: jest.fn(),
  },
  repoService: {
    analyzeRepo: jest.fn(),
  },
}));

describe("Theme toggle", () => {
  test("updates the root theme state when toggled", async () => {
    authService.getRepos.mockResolvedValue({ data: [] });
    useGithubAuth.mockReturnValue({
      token: "",
      username: "",
      statusMessage: "",
      setStatusMessage: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
    });

    render(
      <MemoryRouter>
        <GitHubUploadPage />
      </MemoryRouter>
    );

    const toggle = screen.getByTitle(/toggle dark\/light mode/i);

    expect(document.documentElement).not.toHaveClass("dark");

    await userEvent.click(toggle);
    expect(document.documentElement).toHaveClass("dark");

    await userEvent.click(toggle);
    expect(document.documentElement).not.toHaveClass("dark");
  });
});
