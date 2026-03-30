import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import GitHubUploadPage from "../pages/GitHubUploadPage";
import { useGithubAuth } from "../hooks/useGithubAuth";

jest.mock("../hooks/useGithubAuth");
jest.mock("../services/api", () => ({
  authService: {
    getRepos: jest.fn(),
  },
  repoService: {
    analyzeRepo: jest.fn(),
  },
}));

describe("Login", () => {
  test("renders login button and triggers OAuth action when clicked", async () => {
    const login = jest.fn();

    useGithubAuth.mockReturnValue({
      token: "",
      username: "",
      statusMessage: "",
      setStatusMessage: jest.fn(),
      login,
      logout: jest.fn(),
    });

    render(
      <MemoryRouter>
        <GitHubUploadPage />
      </MemoryRouter>
    );

    const button = screen.getByRole("button", { name: /login with github/i });
    expect(button).toBeInTheDocument();

    await userEvent.click(button);

    expect(login).toHaveBeenCalledTimes(1);
  });
});
