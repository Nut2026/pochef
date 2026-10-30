# Pochef

### Your Digital Kitchen Twin — smart meals, smarter spending, zero food waste.

[![Built with React](https://img.shields.io/badge/Built%20with-React-61DAFB.svg?style=flat-square&logo=react&logoColor=white)](https://reactjs.org/)
[![Uses TypeScript](https://img.shields.io/badge/Uses-TypeScript-3178C6.svg?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Powered by Vite](https://img.shields.io/badge/Powered%20by-Vite-646CFF.svg?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Styled with Tailwind](https://img.shields.io/badge/Styled%20with-Tailwind-38B2AC.svg?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Backend: Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E.svg?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

## Vision & Mission

Pochef aims to be a **privacy-conscious**, practical companion for the modern kitchen, turning everyday ingredients into smarter meals.

**Vision**: A world where kitchen planning is effortless, food waste is a thing of the past, and cooking feels creative instead of chaotic.

**Mission**: To build a friendly, accessible kitchen assistant that helps people track what they have, plan meals with confidence, cook together, and stretch every ingredient — without cluttering your inbox or selling your habits.

## About Pochef

I built Pochef for the kitchen itself. It started from watching the fridge door become a memo pad, forgotten leftovers, and the same "what's for dinner?" question every evening. Pochef is my take on a digital kitchen twin — a place where your pantry, your recipes, and the people you cook with can all live together.

### How I built Pochef
**Day 1**: **Planning**. I outlined Pochef's purpose, the problems it should solve, and the shapes I wanted it to take. Then I wrote documentation to settle on the visual language, what each feature does, how the flows should feel, and where everything belongs.

**Day 2-3**: **The skeleton**. After splitting the documentation into phases, I built Pochef piece by piece:
- The shell: header, sidebar, and layout first, so every page shared the same rhythm
- Inventory, starting with add/edit/remove flows and the scanning ideas, then wiring the items into the rest of the app
- Meal planning and recipe generation, building the plan grid, the saved-recipes area, and the generation flows last so the structure could guide where they fit best
- Cooking together, where I started with the session view and only afterwards added the room-code entry and the live collaboration bits
- Nutrition and grocery, which were relatively straightforward once the shared pieces were in place

**Day 4**: **Polishing**. I used Pochef as if it were my own kitchen for a day to find rough edges, review the technical details, and improve the parts that felt slow or awkward. The places that mattered most got attention here: the live refresh behaviour, the repeated patterns that could be cleaned up, and the little interactions that decide whether a feature feels smooth or fiddly.

All in all, I've aimed for a kitchen tool that feels practical and warm rather than clinical or overloaded.

## Features

### Inventory & Shelf Life
- Add, scan, and manage ingredients with quantities and expiry dates
- Shelf-life tracking so food gets used before it is forgotten
- Realtime sync across the app when multiple pieces are open

### Meal Planning
- Plan meals across the week
- Save and revisit favourite recipes
- Combine planning with the ingredients you already have

### Recipe Generation
- Generate recipes from the ingredients on hand
- Customise by diet and preferences
- Export plans to PDF for the kitchen counter

### Cooking Together
- Shared cooking sessions with a room code
- Live collaboration while cooking
- Nutrition logging tied to the meal you are making

### Nutrition & Grocery
- Nutrition tracking for the meals you cook
- Grocery lists that grow out of what the kitchen actually needs

## License

Pochef is licensed under the MIT License — please see the [LICENSE](LICENSE) file for details.

## Acknowledgements

- **React** for the component model that keeps a kitchen app composable
- **Vite** for a fast, pleasant build experience
- **TypeScript** for catching the sorts of mistakes that show up at 9pm at the stove
- **Tailwind CSS** for the styling system
- **Supabase** for auth, database, and realtime
- **Radix UI** for the accessible primitives underneath the components
- **Lucide React** for the icons
- **jsPDF** for recipe export

Pochef wouldn't be here without them!

## Future Roadmap

- [ ] Richer recipe export and printing
- [ ] Better meal-planning suggestions from what is already in the kitchen
- [ ] More flexible dietary and preference filters
- [ ] Improved scanning flows for inventory entry
- [ ] Smarter notifications and reminders for expiring food

And many more through experiments, exposure, feedback, and tiny "aha!" moments

## 🎉 Show Your Support

If you find Pochef interesting, feel free to:
- ⭐ Star the repository
- 🍴 Fork it to explore
- 👀 Watch for updates
- 📢 Share it with anyone who spends too long wondering what to cook

---

> **Built with ❤️ for kitchens that work a little harder, so people do not have to.**
