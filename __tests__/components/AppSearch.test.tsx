import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppSearch from "@/components/AppSearch";

const defaultProps = {
  iosId: "",
  androidId: "",
  onIosIdChange: jest.fn(),
  onAndroidIdChange: jest.fn(),
  onSearch: jest.fn(),
  loading: false,
};

describe("AppSearch", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders both inputs and the submit button", () => {
    render(<AppSearch {...defaultProps} />);
    expect(screen.getByLabelText("App Store ID")).toBeInTheDocument();
    expect(screen.getByLabelText("Google Play Package")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Look up" })).toBeInTheDocument();
  });

  it("reflects controlled iosId value", () => {
    render(<AppSearch {...defaultProps} iosId="829587759" />);
    expect(screen.getByLabelText("App Store ID")).toHaveValue("829587759");
  });

  it("reflects controlled androidId value", () => {
    render(
      <AppSearch {...defaultProps} androidId="com.babbel.mobile.android.en" />
    );
    expect(screen.getByLabelText("Google Play Package")).toHaveValue(
      "com.babbel.mobile.android.en"
    );
  });

  it("calls onIosIdChange when typing in the iOS input", async () => {
    const onIosIdChange = jest.fn();
    render(<AppSearch {...defaultProps} onIosIdChange={onIosIdChange} />);
    await userEvent.type(screen.getByLabelText("App Store ID"), "abc");
    expect(onIosIdChange).toHaveBeenCalled();
  });

  it("calls onAndroidIdChange when typing in the Android input", async () => {
    const onAndroidIdChange = jest.fn();
    render(<AppSearch {...defaultProps} onAndroidIdChange={onAndroidIdChange} />);
    await userEvent.type(screen.getByLabelText("Google Play Package"), "com");
    expect(onAndroidIdChange).toHaveBeenCalled();
  });

  it("calls onSearch with trimmed values on submit", async () => {
    const onSearch = jest.fn();
    render(
      <AppSearch
        {...defaultProps}
        iosId="  829587759  "
        androidId="  com.babbel.mobile.android.en  "
        onSearch={onSearch}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Look up" }));
    expect(onSearch).toHaveBeenCalledWith({
      iosId: "829587759",
      androidId: "com.babbel.mobile.android.en",
    });
  });

  it("disables the submit button when both fields are empty", () => {
    render(<AppSearch {...defaultProps} iosId="" androidId="" />);
    expect(screen.getByRole("button", { name: "Look up" })).toBeDisabled();
  });

  it("disables the submit button while loading", () => {
    render(<AppSearch {...defaultProps} iosId="abc" loading />);
    expect(screen.getByRole("button", { name: "Fetching…" })).toBeDisabled();
  });

  it("does not call onSearch when both fields are empty", async () => {
    const onSearch = jest.fn();
    render(<AppSearch {...defaultProps} onSearch={onSearch} />);
    await userEvent.click(screen.getByRole("button", { name: "Look up" }));
    expect(onSearch).not.toHaveBeenCalled();
  });
});
