import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthGate } from "@/components/AuthGate";
import { boardFixture } from "@/test/boardFixture";

let signedIn = false;

beforeEach(() => {
  signedIn = false;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url === "/api/me") {
      return signedIn
        ? new Response(JSON.stringify({ username: "user" }), { status: 200 })
        : new Response("{}", { status: 401 });
    }
    if (url === "/api/login") {
      const { username, password } = JSON.parse(init?.body as string);
      signedIn = username === "user" && password === "password";
      return new Response("{}", { status: signedIn ? 200 : 401 });
    }
    if (url === "/api/board") {
      return new Response(JSON.stringify(boardFixture), { status: 200 });
    }
    if (url === "/api/logout") {
      signedIn = false;
      return new Response("{}", { status: 200 });
    }
    throw new Error(`Unexpected fetch ${url}`);
  });
});

afterEach(() => vi.restoreAllMocks());

const signIn = async (username: string, password: string) => {
  await userEvent.type(await screen.findByLabelText(/username/i), username);
  await userEvent.type(screen.getByLabelText(/password/i), password);
  await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
};

describe("AuthGate", () => {
  it("shows the login form when not signed in", async () => {
    render(<AuthGate />);
    expect(await screen.findByRole("button", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByTestId(/column-/)).not.toBeInTheDocument();
  });

  it("shows the board when already signed in", async () => {
    signedIn = true;
    render(<AuthGate />);
    expect(await screen.findAllByTestId(/column-/)).toHaveLength(5);
  });

  it("shows an error for wrong credentials", async () => {
    render(<AuthGate />);
    await signIn("user", "wrong");
    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid username or password/i);
    expect(screen.queryByTestId(/column-/)).not.toBeInTheDocument();
  });

  it("signs in and out", async () => {
    render(<AuthGate />);
    await signIn("user", "password");
    expect(await screen.findAllByTestId(/column-/)).toHaveLength(5);

    await userEvent.click(screen.getByRole("button", { name: /log out/i }));
    expect(await screen.findByRole("button", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByTestId(/column-/)).not.toBeInTheDocument();
  });
});
