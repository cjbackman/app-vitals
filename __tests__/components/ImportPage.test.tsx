import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ImportPage from "@/components/ImportPage";

const mockFetch = jest.fn();
global.fetch = mockFetch;

const VALID_CSV =
  "store,app_id,saved_at,score,review_count,min_installs\n" +
  "ios,com.spotify.client,2025-08-01,4.7,12000000,\n" +
  "android,com.spotify.music,2025-08-01,4.3,23000000,1000000000";

function makeFile(content: string, name = "history.csv"): File {
  return new File([content], name, { type: "text/csv" });
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("ImportPage", () => {
  it("renders file picker with accept=.csv", () => {
    render(<ImportPage />);
    const input = screen.getByLabelText("CSV file") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.getAttribute("accept")).toBe(".csv");
  });

  it("Import button is disabled when no file is selected", () => {
    render(<ImportPage />);
    expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
  });

  it("shows row count after a valid file is selected", async () => {
    render(<ImportPage />);
    const input = screen.getByLabelText("CSV file") as HTMLInputElement;

    await act(async () => {
      await userEvent.upload(input, makeFile(VALID_CSV));
    });

    expect(await screen.findByText(/2 rows ready to import/)).toBeInTheDocument();
  });

  it("enables Import button after a valid file is selected", async () => {
    render(<ImportPage />);
    const input = screen.getByLabelText("CSV file") as HTMLInputElement;

    await act(async () => {
      await userEvent.upload(input, makeFile(VALID_CSV));
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Import" })).not.toBeDisabled()
    );
  });

  it("shows parse error when headers don't match", async () => {
    render(<ImportPage />);
    const input = screen.getByLabelText("CSV file") as HTMLInputElement;
    const badCsv = "wrong,headers\ndata,here";

    await act(async () => {
      await userEvent.upload(input, makeFile(badCsv));
    });

    expect(await screen.findByText(/Invalid headers/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
  });

  it("shows error when file exceeds 1000 rows", async () => {
    const rows = Array.from({ length: 1001 }, (_, i) =>
      `ios,com.app${i},2025-08-01,4.7,1000,`
    ).join("\n");
    const csv = "store,app_id,saved_at,score,review_count,min_installs\n" + rows;

    render(<ImportPage />);
    const input = screen.getByLabelText("CSV file") as HTMLInputElement;

    await act(async () => {
      await userEvent.upload(input, makeFile(csv));
    });

    expect(await screen.findByText(/exceeds/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
  });

  it("calls POST /api/snapshots/bulk with correct body on submit", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ inserted: 2, skipped: 0 }),
    } as Response);

    render(<ImportPage />);
    const input = screen.getByLabelText("CSV file") as HTMLInputElement;

    await act(async () => {
      await userEvent.upload(input, makeFile(VALID_CSV));
    });

    await userEvent.click(await screen.findByRole("button", { name: "Import" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/snapshots/bulk");
    expect(opts.method).toBe("POST");

    const body = JSON.parse(opts.body as string) as { rows: unknown[] };
    expect(body.rows).toHaveLength(2);
  });

  it("shows result banner after successful import", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ inserted: 2, skipped: 1 }),
    } as Response);

    render(<ImportPage />);
    const input = screen.getByLabelText("CSV file") as HTMLInputElement;

    await act(async () => {
      await userEvent.upload(input, makeFile(VALID_CSV));
    });

    await userEvent.click(await screen.findByRole("button", { name: "Import" }));

    expect(await screen.findByText(/Inserted 2/)).toBeInTheDocument();
    expect(screen.getByText(/Skipped 1 duplicate/)).toBeInTheDocument();
  });

  it("shows error banner on fetch failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    render(<ImportPage />);
    const input = screen.getByLabelText("CSV file") as HTMLInputElement;

    await act(async () => {
      await userEvent.upload(input, makeFile(VALID_CSV));
    });

    await userEvent.click(await screen.findByRole("button", { name: "Import" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/Could not reach the server/);
  });

  it("shows server error message on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "rows must not exceed 1000", code: "INVALID_SNAPSHOT_PARAMS" }),
    } as Response);

    render(<ImportPage />);
    const input = screen.getByLabelText("CSV file") as HTMLInputElement;

    await act(async () => {
      await userEvent.upload(input, makeFile(VALID_CSV));
    });

    await userEvent.click(await screen.findByRole("button", { name: "Import" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/rows must not exceed 1000/);
  });
});
