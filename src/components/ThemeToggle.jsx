import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const KEY = "safe-tube-theme";

function apply(theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#12161a" : "#2c7a7b");
}

export function savedTheme() {
  return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(savedTheme);

  useEffect(() => {
    apply(theme);
    localStorage.setItem(KEY, theme);
  }, [theme]);

  const dark = theme === "dark";
  return (
    <button
      type="button"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="grid h-12 w-12 place-items-center rounded-full border border-border bg-card text-foreground hover:bg-accent"
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
