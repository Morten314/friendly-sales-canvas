import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ApolloConnectModal } from "../ApolloConnectModal";

import { server } from "@/test/msw/server";

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("ApolloConnectModal", () => {
  it("connects successfully and calls onConnected", async () => {
    server.use(
      http.post("/api/connectors/apollo/connect", () =>
        HttpResponse.json({ connected: true, status: "connected" }),
      ),
    );
    const onConnected = vi.fn();
    wrap(
      <ApolloConnectModal
        open
        orgId="o1"
        userId="u1"
        onClose={vi.fn()}
        onConnected={onConnected}
        onDeepLink={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText(/api key/i), { target: { value: "master-key" } });
    fireEvent.click(screen.getByRole("button", { name: /connect/i }));
    await waitFor(() => expect(onConnected).toHaveBeenCalled());
  });

  it("shows a deep-link button on profile_incomplete (UC6)", async () => {
    server.use(
      http.post("/api/connectors/apollo/connect", () =>
        HttpResponse.json(
          { detail: "incomplete", code: "profile_incomplete", missing_section: "industry" },
          { status: 409 },
        ),
      ),
    );
    const onDeepLink = vi.fn();
    wrap(
      <ApolloConnectModal
        open
        orgId="o1"
        userId="u1"
        onClose={vi.fn()}
        onConnected={vi.fn()}
        onDeepLink={onDeepLink}
      />,
    );
    fireEvent.change(screen.getByLabelText(/api key/i), { target: { value: "k" } });
    fireEvent.click(screen.getByRole("button", { name: /connect/i }));
    const fix = await screen.findByRole("button", { name: /complete your profile/i });
    fireEvent.click(fix);
    expect(onDeepLink).toHaveBeenCalledWith("industry");
  });

  it("shows a master-key message on 403", async () => {
    server.use(
      http.post("/api/connectors/apollo/connect", () =>
        HttpResponse.json(
          { detail: "needs master key", code: "master_key_required" },
          { status: 403 },
        ),
      ),
    );
    wrap(
      <ApolloConnectModal
        open
        orgId="o1"
        userId="u1"
        onClose={vi.fn()}
        onConnected={vi.fn()}
        onDeepLink={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText(/api key/i), { target: { value: "k" } });
    fireEvent.click(screen.getByRole("button", { name: /connect/i }));
    expect(await screen.findByText(/master api key/i)).toBeInTheDocument();
  });

  it("shows a connection message (not 'invalid key') on a network failure", async () => {
    server.use(http.post("/api/connectors/apollo/connect", () => HttpResponse.error()));
    wrap(
      <ApolloConnectModal
        open
        orgId="o1"
        userId="u1"
        onClose={vi.fn()}
        onConnected={vi.fn()}
        onDeepLink={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText(/api key/i), { target: { value: "k" } });
    fireEvent.click(screen.getByRole("button", { name: /connect/i }));
    expect(await screen.findByText(/couldn't reach apollo/i)).toBeInTheDocument();
    expect(screen.queryByText(/invalid key/i)).not.toBeInTheDocument();
  });

  it("shows the invalid-key message on a server rejection without a recognized code", async () => {
    server.use(
      http.post("/api/connectors/apollo/connect", () =>
        HttpResponse.json({ detail: "bad key" }, { status: 400 }),
      ),
    );
    wrap(
      <ApolloConnectModal
        open
        orgId="o1"
        userId="u1"
        onClose={vi.fn()}
        onConnected={vi.fn()}
        onDeepLink={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText(/api key/i), { target: { value: "k" } });
    fireEvent.click(screen.getByRole("button", { name: /connect/i }));
    expect(await screen.findByText(/invalid key/i)).toBeInTheDocument();
  });

  it("renders update-mode copy with an empty field", () => {
    wrap(
      <ApolloConnectModal
        open
        mode="update"
        orgId="o1"
        userId="u1"
        onClose={vi.fn()}
        onConnected={vi.fn()}
        onDeepLink={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: /update apollo api key/i })).toBeInTheDocument();
    expect(screen.getByText(/a key is already connected/i)).toBeInTheDocument();
    const input = screen.getByLabelText(/^api key$/i) as HTMLInputElement;
    expect(input.value).toBe("");
    expect(input).toHaveAttribute("placeholder", "Enter new Apollo master key");
    expect(screen.getByRole("button", { name: /^update$/i })).toBeInTheDocument();
  });

  it("update mode still posts to /connect and calls onConnected", async () => {
    server.use(
      http.post("/api/connectors/apollo/connect", () =>
        HttpResponse.json({ connected: true, status: "connected" }),
      ),
    );
    const onConnected = vi.fn();
    wrap(
      <ApolloConnectModal
        open
        mode="update"
        orgId="o1"
        userId="u1"
        onClose={vi.fn()}
        onConnected={onConnected}
        onDeepLink={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText(/^api key$/i), { target: { value: "rotated-key" } });
    fireEvent.click(screen.getByRole("button", { name: /^update$/i }));
    await waitFor(() => expect(onConnected).toHaveBeenCalled());
  });
});
