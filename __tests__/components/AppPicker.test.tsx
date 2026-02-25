import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppPicker from "@/components/AppPicker";
import { PRESET_APPS } from "@/components/PresetApps";

// next/image doesn't render in jsdom — mock it as a plain <img>
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; sizes?: string }) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    const { fill: _fill, sizes: _sizes, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...rest} />;
  },
}));

const babbel = PRESET_APPS[0];
const duolingo = PRESET_APPS[1];

describe("AppPicker", () => {
  it("renders a button for each preset", () => {
    render(<AppPicker selectedPreset={null} onSelect={jest.fn()} />);
    expect(screen.getByText(babbel.name)).toBeInTheDocument();
    expect(screen.getByText(duolingo.name)).toBeInTheDocument();
  });

  it("calls onSelect with the Babbel preset when clicked", async () => {
    const onSelect = jest.fn();
    render(<AppPicker selectedPreset={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByText(babbel.name));
    expect(onSelect).toHaveBeenCalledWith(babbel);
  });

  it("calls onSelect with the Duolingo preset when clicked", async () => {
    const onSelect = jest.fn();
    render(<AppPicker selectedPreset={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByText(duolingo.name));
    expect(onSelect).toHaveBeenCalledWith(duolingo);
  });

  it("sets aria-pressed=true on the active preset", () => {
    render(<AppPicker selectedPreset={babbel} onSelect={jest.fn()} />);
    expect(screen.getByRole("button", { name: babbel.name })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("sets aria-pressed=false when no preset is selected", () => {
    render(<AppPicker selectedPreset={null} onSelect={jest.fn()} />);
    expect(screen.getByRole("button", { name: babbel.name })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

});
