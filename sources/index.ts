import { Source } from "@/utils/sourceModel";
import mangaDex from "./MangaDex";

export const sources = [
  {
    name: mangaDex.name || "Test Source",
    icon: mangaDex.icon || "https://example.com/icon.png", // Replace with actual icon URL
    source: mangaDex,
  },
];

export const placeHolderSource = new Source({
  name: "placeholder",
  baseUrl: "example.com",
  icon: "https://example.com/icon.png",
})