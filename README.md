# Pochef: A Hackathon-Winning Website

## 1. Application Overview

### 1.1 Application Name

Pochef

### 1.2 Application Description

Pochef is an AI-powered personal chef web application that manages users' entire kitchen ecosystem. It maintains a living Digital Twin of refrigerators, pantries, and fermentation stations, intelligently suggests meals based on available ingredients, tracks ripening produce, guides users through cooking via conversational AI, and automatically updates inventory and nutrition upon meal completion.

OR

Pochef is a smart personal chef web application that manages your entire kitchen ecosystem. It maintains a Digital Twin of refrigerators, pantries, and fermentation stations, intelligently suggests meals based on available ingredients, tracks ripening produce, guides users through cooking via conversations, and automatically updates inventory and nutrition upon meal completion.

### 1.3 Tagline + Theme + Icon

Tagline: Your Digital Kitchen Twin.

Icon: An image file of a copper rose fried egg


Theme/Style:


## Theme Philosophy

### The Vision

Pochef combines the **warmth and sophistication of copper** with the **modern, ethereal quality of glassmorphism**. This creates a design language that feels both **premium and approachable**—a digital kitchen assistant that's elegant yet practical.

### How This Combination Works for Pochef

| Element                   | Copper Rose                      | Glassmorphism                    | Synergy                         |
| ------------------------- | -------------------------------- | -------------------------------- | ------------------------------- |
| **Texture**         | Warm, metallic, grounded         | Light, translucent, airy         | Balances weight with lightness  |
| **Color**           | Earthy, rich, comforting         | Soft, gradient, modern           | Creates visual depth and warmth |
| **Vibe**            | Craftsmanship, tradition         | Innovation, future-forward       | "Heritage cooking meets AI"     |
| **Food Connection** | Copper cookware, rustic kitchens | Clean, organized, modern kitchen | "Professional but homey"        |
| **User Feel**       | Trustworthy, premium             | Sleek, cutting-edge              | "High-tech but not cold"        |

### The Emotional Impact

- **Copper Rose** evokes warmth, quality, and culinary tradition
- **Glassmorphism** evokes clarity, sophistication, and modern AI capability
- **Together:** "Your kitchen, elevated by AI, without losing its soul"

---

## 2. Color Palette

### Primary Colors

```
Copper Rose (#B87333)
Uses: Primary buttons, headers, key UI elements
```

```
Rose Gold (#E8A87C)
Uses: Secondary accents, hover states, highlights
```

```
Deep Cocoa (#2C1810)
Uses: Primary text, dark elements, contrast
```

```
Warm Cream (#FDF6F0)
Uses: Backgrounds, cards, light elements
```

```
Soft Blush (#F5E6D3)
Uses: Subtle backgrounds, card surfaces
```

### Glassmorphism Colors

```
Glass Base: rgba(253, 246, 240, 0.15)
Glass Border: rgba(184, 115, 51, 0.2)
Glass Shadow: rgba(44, 24, 16, 0.1)
Glass Blur: 20px
```

### Gradient Accents

```
Copper Gradient: linear-gradient(135deg, #B87333, #E8A87C)
Warm Glow: radial-gradient(circle, rgba(232, 168, 124, 0.3), transparent)
```

### Glass Variants

| Variant               | Background             | Border                | Blur | Use Case        |
| --------------------- | ---------------------- | --------------------- | ---- | --------------- |
| **Standard**    | rgba(253,246,240,0.15) | rgba(184,115,51,0.2)  | 20px | Cards, panels   |
| **Light**       | rgba(253,246,240,0.08) | rgba(184,115,51,0.1)  | 10px | Subtle overlays |
| **Heavy**       | rgba(253,246,240,0.25) | rgba(184,115,51,0.3)  | 30px | Headers, modals |
| **Copper Tint** | rgba(184,115,51,0.08)  | rgba(184,115,51,0.15) | 15px | Special accents |


## 2. Users and Usage Scenarios

### 2.1 Target Users

- Home cooks seeking to reduce food waste
- Individuals managing dietary goals and nutrition tracking
- Users interested in fermentation and food preservation
- Households with multiple members cooking together

### 2.2 Core Usage Scenarios

- Scanning grocery receipts to automatically populate inventory
- Planning meals based on ingredients nearing expiration
- Following step-by-step cooking guidance with real-time assistance
- Tracking fermentation batches with stage-specific notifications
- Generating smart grocery lists based on planned meals
- Monitoring food waste and associated costs

## 3. Page Structure and Functional Description

### 3.1 Page Structure

```
Pochef Web Application
├── Authentication Pages
│   ├── Sign-Up Page
│   └── Login Page
├── Dashboard (Home)
├── Inventory Management
│   ├── Chopping Board View
│   ├── Add Ingredient (Receipt Scan / Visual Recognition / Voice / Manual)
│   ├── Fermentation & Ripening Dashboard
│   └── Waste Log
├── Meal Planning
│   ├── Recipe Suggestions
│   ├── Advanced Filters
│   └── Pantry to Plate Time Slider
├── Cooking Assistant
│   ├── Recipe Detail View
│   └── Hybrid Chat + Action Interface
├── Nutrition Tracking
└── Grocery Lists
```

### 3.2 Authentication Pages

#### 3.2.1 Sign-Up Page

- Users input Username, Email, Password, and Confirm Password
- System validates password match and email format
- Supabase Auth handles secure password hashing and account creation
- Email verification sent upon successful registration

#### 3.2.2 Login Page

- Users log in using either Username or Email, alongside Password (mandatory)
- Supabase Auth manages session creation and authentication
- Redirect to Dashboard upon successful login

### 3.3 Dashboard (Home)

- Display overview of current inventory status
- Show ingredients nearing expiration with visual alerts
- Present quick access to meal planning and cooking assistant
- Display active fermentation batches with progress indicators
- Show monthly food waste statistics

### 3.4 Inventory Management

#### 3.4.1 Chopping Board View

- Display ingredients as colored bubbles in a 2D draggable grid
- Bubbles physically shrink as ingredients approach expiration date
- Animate rot effect when ingredients expire
- Allow users to drag and organize bubbles
- Click bubble to view/edit ingredient details

#### 3.4.2 Add Ingredient

- **Receipt Scanning:** Users capture photo of printed grocery receipt. Gemini 2.0 Flash processes OCR to extract item names, quantities, and prices. System auto-adds parsed items to inventory.
- **Visual Recognition:** Users photograph fruits, vegetables, or packaged items. Gemini 2.0 Flash identifies food items with confidence scores and catalogs them.
- **Voice Input:** Users speak natural language commands (e.g., \"Add 3 apples and 2 bananas\"). Browser's Web Speech API transcribes speech to text. Groq API parses transcribed text into structured inventory items with quantities and units.
- **Manual Entry:** Users input ingredient name, quantity, unit, purchase date, and storage location via text form.
- System estimates Best Before dates based on purchase date and storage location (Refrigerator, Freezer, Room Temperature, Root Cellar) using local database of typical shelf lives.
- Users can manually adjust estimated expiry date via slider.

#### 3.4.3 Fermentation & Ripening Dashboard

- **Ripening Module:**
  - Track produce items (Avocados, Bananas, Tomatoes)
  - Display linear regression estimate of ripening time
  - Provide Ripeness Slider for users to manually adjust ripening stage
  - System refines future predictions based on user adjustments
- **Fermentation Module:**
  - Users create Batch for fermented foods: Pickles, Yoghurt, Kefir (Milk/Water), Kombucha (Primary & Secondary), Natto, Sauerkraut, Kimchi, Sourdough Starters
  - Track fermentation stages and timelines
  - Send push notifications for critical actions (e.g., \"Day 3: Burp your pickles to release CO2\")
  - Display AI-generated images showing expected appearance on Day 1 vs. Day 7 for food safety reference
  - OpenAI GPT-4o-mini generates textual descriptions and stage tracking logic
  - Stable Diffusion generates expected appearance images

#### 3.4.4 Waste Log

- When ingredient expires, system prompts: \"Did you throw this away, or did you eat it?\"
- If thrown away, log cost into Dollars Wasted This Month graph
- Display monthly waste statistics with cost breakdown

### 3.5 Meal Planning

#### 3.5.1 Recipe Suggestions

- By default, AI prioritizes ingredients with nearest expiration date
- Users can toggle expiration priority on/off
- Display recipe cards with high-fidelity realistic imagery (Stable Diffusion), difficulty, meal type, total duration, and serving size
- OpenAI GPT-4o-mini generates recipe suggestions prioritizing expiring ingredients
- TheMealDB API provides base recipe database

#### 3.5.2 Advanced Filters

- **Dietary Goals:** Balanced, Keto, Vegan, High-Protein, Low-Carb
- **Meal Type:** Breakfast, Brunch, Lunch, Snacks, Dinner, Supper
- **Difficulty:** Beginner, Intermediate, Advanced
- **Preferences:** Spicy / Non-spicy, Baked / Deep-fried / Steamed / Pan-fried
- **Cuisine:** American, Italian, Mediterranean, Chinese, Indian, Thai, Japanese
- **Constraints:** Natural language exclusions/inclusions (e.g., \"Remove tomatoes\" / \"Use broccoli\")
- **Available Cookware:** Users pre-set owned cookware (Air Fryer, Dutch Oven, Cast Iron, etc.). AI filters out recipes requiring unavailable equipment and suggests substitutions.
- TheMealDB API (https://www.themealdb.com/api/json/v1/1/) provides base recipe data
- OpenAI GPT-4o-mini handles complex filtering and constraint processing
- Groq performs cookware filtering and substitution suggestions

#### 3.5.3 Use-Up Mode

- When specific ingredient selected, AI asks: \"Use 100% of this in one dish, or split it between two meals?\"
- Generate meal plan accommodating exact quantity split
- Groq handles this logic

#### 3.5.4 Pantry to Plate Time Slider

- Display slider from 15 mins to 3 Hours
- Moving slider dynamically regenerates recipe list matching user's available time
- Groq filters and re-prioritizes TheMealDB recipes based on selected time constraint

### 3.6 Cooking Assistant

#### 3.6.1 Recipe Detail View

- Display high-fidelity realistic imagery (Stable Diffusion, cached to avoid repeated generation)
- Show difficulty, meal type, total duration, and serving pax
- Present step-by-step instructions with in-built timers and interactive checkboxes for each step
- TheMealDB API provides base recipe instructions
- OpenAI GPT-4o-mini enhances instructions, adds estimated timers for each step, and breaks down complex steps
- Provide temperature conversion toggle (Celsius / Fahrenheit)

#### 3.6.2 Hybrid Chat + Action Interface

- **Main Chat Window:** Display AI's step-by-step natural language instructions (OpenAI GPT-4o-mini)
- **Manual Typing:** Users type questions into chat panel. Inputs sent to OpenAI GPT-4o-mini via persistent thread
- **Three Persistent Quick-Action Buttons:**
  1. Pause: AI stops current timer and waits
  2. I'm done with this step: AI confirms completion and moves to next step
  3. Help!: AI asks \"What's wrong? Too salty? Too dry?\" and provides instant remediation
- Buttons trigger specific functions in OpenAI GPT-4o-mini thread
- Maintain persistent Thread ID per recipe session, stored in Supabase
- Remember user's current step even if browser closed
- Support contextual Q&A without losing place (e.g., \"How do I make this crispier?\" or \"Can I marinate for 30 mins instead of 20?\")
- AI provides specialized answers and recalculates nutrition/timing if substitution affects dish (OpenAI GPT-4o-mini)

### 3.7 Post-Meal Logistics

#### 3.7.1 I Ate This Button

- Upon completing meal, user clicks button
- **Inventory Update:** Deduct exact quantities of ingredients used from inventory in real-time
- **Nutrition Update:** Log meal's macros (Calories, Protein, Carbs, Fat) to user's daily nutritional profile
- TheMealDB API provides recipe instructions and ingredient lists NOT nutrition data. **Groq** estimates nutritional values based on ingredients and quantities, calculating approximate macros (Calories, Protein, Carbs, Fat).
- **Nutritional Banking:** If user eats heavy lunch (e.g., 800 kcal), system automatically adjusts dinner suggestion to fit remaining daily caloric budget
- Groq tracks daily caloric intake and suggests future meals within target

### 3.8 Nutrition Tracking

- Display daily, weekly, and monthly nutritional summaries
- Show macros breakdown (Calories, Protein, Carbs, Fat)
- Visualize progress toward dietary goals

### 3.9 Grocery Lists

- Automatically generate dynamic shopping lists based on upcoming meal plans or items flagged as Low Inventory
- Cross-reference existing inventory to ensure user only buys missing items
- Groq compares planned recipes against current inventory and generates consolidated shopping list with natural language descriptions
- Allow users to manually add/remove items
- Mark items as purchased to update inventory

### 3.10 Multi-User & Real-Time Sync

- **Live Cooking Rooms:** Multiple users (e.g., cooking with partner) join same recipe session
- When one user checks off step on their device, it instantly updates on partner's device
- Supabase Realtime (WebSocket connections) enables live updates
- Add ingredient → meal plan suggestions update instantly
- Log meal → grocery list shrinks instantly
- No refresh button required

## 4. Business Rules and Logic

### 4.1 Inventory Management Rules

- Expiration date estimation based on purchase date and storage location using local database of typical shelf lives
- Storage locations: Refrigerator, Freezer, Room Temperature, Root Cellar
- Users can override estimated expiry dates
- Ripening estimates use linear regression, refined by user feedback via Ripeness Slider
- Fermentation batches track stages with stage-specific notifications

### 4.2 Meal Planning Rules

- Default prioritization: ingredients with nearest expiration date
- Users can toggle expiration priority
- Advanced filters apply combinatorially (e.g., Vegan + High-Protein + Italian + 30 mins)
- Cookware filtering excludes recipes requiring unavailable equipment
- Use-Up Mode ensures exact quantity usage (100% in one dish or split between two meals)
- Time Slider dynamically adjusts recipe suggestions based on available time (15 mins to 3 hours)

### 4.3 Cooking Assistant Rules

- Persistent Thread ID maintains conversation context per recipe session
- Thread ID stored in Supabase, survives browser closure
- Quick-Action Buttons trigger specific AI functions without breaking conversation flow
- Contextual Q&A recalculates nutrition/timing if substitutions affect dish

### 4.4 Nutrition Tracking Rules

- Base nutritional data from TheMealDB API
- Exact macro calculations account for substitutions and portion adjustments
- Nutritional Banking adjusts future meal suggestions to fit remaining daily caloric budget
- Daily caloric intake tracked cumulatively

### 4.5 Grocery List Rules

- Auto-generation based on upcoming meal plans and Low Inventory flags
- Cross-reference existing inventory to avoid duplicate purchases
- Consolidated list with natural language descriptions
- Marking items as purchased updates inventory in real-time

### 4.6 Real-Time Sync Rules

- All inventory changes, meal plan updates, and cooking progress sync instantly across devices
- Live Cooking Rooms enable collaborative cooking with step synchronization
- Supabase Realtime WebSocket connections handle all live updates

## 5. Exception and Boundary Conditions

| Scenario                                                                      | Handling                                                            |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Receipt OCR fails to parse items                                              | Allow manual correction or re-scan                                  |
| Visual recognition returns low confidence score                               | Prompt user to confirm or manually enter item                       |
| Voice input transcription unclear                                             | Display transcribed text for user confirmation before adding        |
| Ingredient not found in local shelf life database                             | Prompt user to input custom expiry date                             |
| No recipes match current filters                                              | Display message suggesting filter adjustment or ingredient purchase |
| User lacks required cookware for all suggested recipes                        | Suggest cookware substitutions or alternative recipes               |
| API rate limits exceeded (TheMealDB, Gemini, Groq, OpenAI, Stable Diffusion)  | Display error message and retry after cooldown period               |
| User closes browser during cooking session                                    | Restore session using persistent Thread ID from Supabase            |
| Multiple users edit same inventory item simultaneously                        | Last write wins, with real-time sync to all devices                 |
| Fermentation batch notification fails to send                                 | Log missed notification and display in-app alert                    |
| Nutritional data unavailable for custom recipe                                | Prompt user to manually input macros or skip nutrition logging      |
| Grocery list item marked purchased but inventory not updated                  | Retry update or allow manual inventory adjustment                   |
| User attempts to add ingredient with invalid quantity (e.g., negative number) | Display validation error and prevent submission                     |

## 6. Acceptance Criteria

1. User signs up with Username, Email, Password, and Confirm Password, receives email verification, and successfully logs in using either Username or Email alongside Password.
2. User scans grocery receipt, system parses items via Gemini 2.0 Flash OCR, and ingredients appear in Chopping Board View as colored bubbles with estimated expiry dates.
3. User selects ingredient nearing expiration, system generates meal suggestions prioritizing that ingredient using OpenAI GPT-4o-mini and TheMealDB API.
4. User applies advanced filters (e.g., Vegan + 30 mins + Italian), adjusts Pantry to Plate Time Slider, and system dynamically regenerates recipe list matching all criteria.
5. User selects recipe, enters Cooking Assistant, follows step-by-step instructions with timers, asks contextual question via chat, receives AI response, and completes cooking.
6. User clicks I Ate This button, system deducts used ingredients from inventory, logs meal macros to daily nutrition profile, and updates grocery list in real-time.
7. User creates fermentation batch for Kombucha, system tracks stages, sends Day 3 notification to burp batch, and displays AI-generated expected appearance images.
8. User in Live Cooking Room checks off step on phone, partner's tablet instantly updates to reflect completion via Supabase Realtime.

## 7. Out of Scope for This Release

- File upload restrictions (type, size, quantity)
- Multi-device compatibility optimization (browser-specific adaptations)
- Performance metrics (loading speed, response time, animation frame rates)
- Network error handling (timeout, retry logic)
- Social features (liking, commenting, sharing recipes)
- Multi-language support beyond English
- Offline mode functionality
- Integration with smart kitchen appliances
- Barcode scanning for packaged items
- Meal plan export to calendar apps
- Recipe rating and review system
- User-generated recipe uploads
- Advanced analytics dashboard for dietary trends
- Integration with fitness trackers for calorie burn data
- Subscription or payment processing
- Admin panel for content moderation