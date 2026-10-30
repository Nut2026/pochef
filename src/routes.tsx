import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import AuthPage from './pages/AuthPage';
import CookingAssistantPage from './pages/CookingAssistantPage';
import CookSessionsListPage from './pages/CookSessionsListPage';
import DashboardPage from './pages/DashboardPage';
import FermentationPage from './pages/FermentationPage';
import GroceryPage from './pages/GroceryPage';
import InventoryPage from './pages/InventoryPage';
import LandingPage from './pages/LandingPage';
import MealPlanningPage from './pages/MealPlanningPage';
import NotFound from './pages/NotFound';
import NutritionPage from './pages/NutritionPage';
import PricingPage from './pages/PricingPage';
import PrivacyPage from './pages/PrivacyPage';
import PreferencesPage from './pages/ProfilePage';
import TermsPage from './pages/TermsPage';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  /** Accessible without login. Routes without this flag require authentication. */
  public?: boolean;
}

export const routes: RouteConfig[] = [
  { name: 'Home',         path: '/',               element: <LandingPage />,          public: true  },
  { name: 'Login',        path: '/login',          element: <AuthPage />,             public: true  },
  { name: 'Dashboard',    path: '/dashboard',      element: <DashboardPage />,        public: false },
  { name: 'Inventory',    path: '/inventory',      element: <InventoryPage />,        public: false },
  { name: 'Fermentation', path: '/fermentation',   element: <FermentationPage />,     public: false },
  { name: 'Meal Planning',path: '/meal-planning/*', element: <MealPlanningPage />,    public: false },
  { name: 'Cooking',      path: '/cooking/:roomCode',           element: <CookingAssistantPage />, public: false },
  { name: 'Cooking Hub',  path: '/cooking',                      element: <CookSessionsListPage />, public: false },
  { name: 'Nutrition',    path: '/nutrition',      element: <NutritionPage />,        public: false },
  { name: 'Grocery',      path: '/grocery',        element: <GroceryPage />,          public: false },
  { name: 'Profile',      path: '/profile',        element: <Navigate to="/preferences" replace />, public: false },
  { name: 'Preferences',  path: '/preferences',    element: <PreferencesPage />,      public: false },
  { name: 'Pricing',      path: '/pricing',        element: <PricingPage />,          public: true  },
  { name: 'Terms',        path: '/terms',          element: <TermsPage />,            public: true  },
  { name: 'Privacy',      path: '/privacy',        element: <PrivacyPage />,          public: true  },
  { name: 'Not Found',    path: '/404',            element: <NotFound />,             public: true  },
];
