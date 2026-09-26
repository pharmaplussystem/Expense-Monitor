-- ==============================================================================
-- DAILY EXPENSE MANAGER (UGANDA) - SUPABASE DATABASE SCHEMA
-- Currency: Ugandan Shillings (UGX / USh)
-- Compatible with Supabase Postgres & Row Level Security (RLS)
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- TABLE: profiles
-- Stores user personal profile, preferences, and default currency
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    currency TEXT DEFAULT 'UGX',
    monthly_budget_target NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ==============================================================================
-- TABLE: categories
-- Standard & custom expense/income categories for Ugandan households & businesses
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    icon TEXT DEFAULT 'tag',
    color TEXT DEFAULT '#10B981',
    type TEXT CHECK (type IN ('expense', 'income')) DEFAULT 'expense' NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ==============================================================================
-- TABLE: expenses
-- Daily financial expenditures in Uganda (Food, Transport/Matatu, Airtime, etc.)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    category_name TEXT NOT NULL,
    description TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    time TIME WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIME,
    payment_method TEXT NOT NULL, -- 'Cash', 'Mobile Money' (MTN/Airtel), 'Bank', 'Visa/Mastercard', 'Other'
    location TEXT,
    notes TEXT,
    receipt_url TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ==============================================================================
-- TABLE: income
-- Inflows (Salary, Business, Freelance, Gifts, Investments)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.income (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    source TEXT NOT NULL, -- 'Salary', 'Business income', 'Freelance income', 'Investment', 'Gifts', 'Other'
    description TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT NOT NULL, -- 'Cash', 'Mobile Money', 'Bank', 'Other'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ==============================================================================
-- TABLE: budgets
-- Monthly overall and per-category budget ceilings
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
    category_name TEXT NOT NULL, -- Or 'Overall Monthly'
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    month_year TEXT NOT NULL, -- Format 'YYYY-MM'
    alert_threshold INTEGER DEFAULT 80, -- warn when >= 80%
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_user_category_month UNIQUE (user_id, category_name, month_year)
);

-- ==============================================================================
-- TABLE: savings_goals
-- Targets for savings (e.g. Business capital, Land deposit, School fees)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.savings_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    target_amount NUMERIC(14, 2) NOT NULL CHECK (target_amount > 0),
    current_amount NUMERIC(14, 2) DEFAULT 0 CHECK (current_amount >= 0),
    target_date DATE,
    notes TEXT,
    status TEXT CHECK (status IN ('in_progress', 'completed')) DEFAULT 'in_progress',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ==============================================================================
-- TABLE: debts
-- Tracking "Money I owe" and "Money owed to me"
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type TEXT CHECK (type IN ('i_owe', 'owed_to_me')) NOT NULL,
    person TEXT NOT NULL,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    paid_amount NUMERIC(14, 2) DEFAULT 0 CHECK (paid_amount >= 0),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    description TEXT,
    status TEXT CHECK (status IN ('Active', 'Partially Paid', 'Paid', 'Overdue')) DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ==============================================================================
-- TABLE: recurring_expenses
-- Subscriptions & recurring bills (Rent, Internet, Umeme/Yaka, Water)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.recurring_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    category_name TEXT NOT NULL,
    description TEXT NOT NULL,
    frequency TEXT CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')) DEFAULT 'monthly',
    next_due_date DATE,
    payment_method TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ==============================================================================
-- PERFORMANCE INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON public.expenses (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses (user_id, category_name);
CREATE INDEX IF NOT EXISTS idx_income_user_date ON public.income (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON public.budgets (user_id, month_year);
CREATE INDEX IF NOT EXISTS idx_debts_user_status ON public.debts (user_id, status);
CREATE INDEX IF NOT EXISTS idx_savings_user ON public.savings_goals (user_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Strict isolation: users can ONLY access their own records
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Categories Policies
CREATE POLICY "Users can view own categories" ON public.categories
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON public.categories
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON public.categories
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON public.categories
    FOR DELETE USING (auth.uid() = user_id);

-- Expenses Policies
CREATE POLICY "Users can view own expenses" ON public.expenses
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own expenses" ON public.expenses
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own expenses" ON public.expenses
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own expenses" ON public.expenses
    FOR DELETE USING (auth.uid() = user_id);

-- Income Policies
CREATE POLICY "Users can view own income" ON public.income
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own income" ON public.income
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own income" ON public.income
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own income" ON public.income
    FOR DELETE USING (auth.uid() = user_id);

-- Budgets Policies
CREATE POLICY "Users can view own budgets" ON public.budgets
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own budgets" ON public.budgets
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own budgets" ON public.budgets
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own budgets" ON public.budgets
    FOR DELETE USING (auth.uid() = user_id);

-- Savings Goals Policies
CREATE POLICY "Users can view own savings goals" ON public.savings_goals
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own savings goals" ON public.savings_goals
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own savings goals" ON public.savings_goals
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own savings goals" ON public.savings_goals
    FOR DELETE USING (auth.uid() = user_id);

-- Debts Policies
CREATE POLICY "Users can view own debts" ON public.debts
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own debts" ON public.debts
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own debts" ON public.debts
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own debts" ON public.debts
    FOR DELETE USING (auth.uid() = user_id);

-- Recurring Expenses Policies
CREATE POLICY "Users can view own recurring expenses" ON public.recurring_expenses
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recurring expenses" ON public.recurring_expenses
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recurring expenses" ON public.recurring_expenses
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own recurring expenses" ON public.recurring_expenses
    FOR DELETE USING (auth.uid() = user_id);

-- ==============================================================================
-- AUTOMATIC PROFILE & DEFAULT CATEGORIES SETUP ON USER SIGNUP
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, full_name, phone, currency)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'phone', ''),
    'UGX'
  );

  -- Seed standard Uganda categories for the new user
  INSERT INTO public.categories (user_id, name, icon, color, type, is_default) VALUES
    (new.id, 'Food', 'utensils', '#EF4444', 'expense', true),
    (new.id, 'Transport', 'bus', '#F59E0B', 'expense', true),
    (new.id, 'Rent', 'home', '#3B82F6', 'expense', true),
    (new.id, 'Utilities', 'zap', '#8B5CF6', 'expense', true),
    (new.id, 'Airtime', 'phone-call', '#10B981', 'expense', true),
    (new.id, 'Internet', 'wifi', '#06B6D4', 'expense', true),
    (new.id, 'Shopping', 'shopping-bag', '#EC4899', 'expense', true),
    (new.id, 'Education', 'book-open', '#6366F1', 'expense', true),
    (new.id, 'Medical', 'activity', '#DC2626', 'expense', true),
    (new.id, 'Entertainment', 'film', '#F97316', 'expense', true),
    (new.id, 'Family', 'users', '#14B8A6', 'expense', true),
    (new.id, 'Business', 'briefcase', '#4F46E5', 'expense', true),
    (new.id, 'Church/Donations', 'heart', '#84CC16', 'expense', true),
    (new.id, 'Debt/Loans', 'credit-card', '#64748B', 'expense', true),
    (new.id, 'Other', 'more-horizontal', '#94A3B8', 'expense', true),
    -- Income categories
    (new.id, 'Salary', 'wallet', '#10B981', 'income', true),
    (new.id, 'Business income', 'trending-up', '#059669', 'income', true),
    (new.id, 'Freelance income', 'laptop', '#0D9488', 'income', true),
    (new.id, 'Investment', 'bar-chart-2', '#0284C7', 'income', true),
    (new.id, 'Gifts', 'gift', '#D97706', 'income', true),
    (new.id, 'Other', 'plus-circle', '#6B7280', 'income', true);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger firing on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- STORAGE CONFIGURATION (RECEIPTS BUCKET)
-- Run this block in Supabase SQL editor to create the receipts storage bucket
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Users can only upload and view their own receipts
CREATE POLICY "Users can upload their own receipts"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'receipts'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own receipts"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'receipts'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own receipts"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'receipts'
    AND auth.uid()::text = (storage.foldername(name))[1]
);
