-- Create missing category hierarchy tables for ultra micro level categorization

-- Create sub_categories table
CREATE TABLE IF NOT EXISTS public.sub_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  parent_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT sub_categories_slug_check CHECK (slug ~* '^[a-z0-9-]+$')
);

-- Create micro_categories table
CREATE TABLE IF NOT EXISTS public.micro_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  parent_id UUID REFERENCES public.sub_categories(id) ON DELETE CASCADE,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT micro_categories_slug_check CHECK (slug ~* '^[a-z0-9-]+$')
);

-- Create nano_categories table
CREATE TABLE IF NOT EXISTS public.nano_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  parent_id UUID REFERENCES public.micro_categories(id) ON DELETE CASCADE,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT nano_categories_slug_check CHECK (slug ~* '^[a-z0-9-]+$')
);

-- Add foreign key columns to products table if they don't exist
DO $$
BEGIN
  -- Add sub_category_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'sub_category_id'
  ) THEN
    ALTER TABLE public.products ADD COLUMN sub_category_id UUID REFERENCES public.sub_categories(id) ON DELETE SET NULL;
  END IF;

  -- Add micro_category_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'micro_category_id'
  ) THEN
    ALTER TABLE public.products ADD COLUMN micro_category_id UUID REFERENCES public.micro_categories(id) ON DELETE SET NULL;
  END IF;

  -- Add nano_category_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'nano_category_id'
  ) THEN
    ALTER TABLE public.products ADD COLUMN nano_category_id UUID REFERENCES public.nano_categories(id) ON DELETE SET NULL;
  END IF;

  -- Add is_active flag if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.products ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
  END IF;

  -- Add deleted_at for soft delete if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE public.products ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sub_categories_parent_id ON public.sub_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_sub_categories_slug ON public.sub_categories(slug);
CREATE INDEX IF NOT EXISTS idx_micro_categories_parent_id ON public.micro_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_micro_categories_slug ON public.micro_categories(slug);
CREATE INDEX IF NOT EXISTS idx_nano_categories_parent_id ON public.nano_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_nano_categories_slug ON public.nano_categories(slug);
CREATE INDEX IF NOT EXISTS idx_products_sub_category_id ON public.products(sub_category_id);
CREATE INDEX IF NOT EXISTS idx_products_micro_category_id ON public.products(micro_category_id);
CREATE INDEX IF NOT EXISTS idx_products_nano_category_id ON public.products(nano_category_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON public.products(deleted_at);

-- Enable Row Level Security
ALTER TABLE public.sub_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.micro_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nano_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sub_categories
CREATE POLICY "Sub categories are viewable by everyone"
ON public.sub_categories FOR SELECT
USING (true);

CREATE POLICY "Admins can insert sub categories"
ON public.sub_categories FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admins can update sub categories"
ON public.sub_categories FOR UPDATE
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admins can delete sub categories"
ON public.sub_categories FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- RLS Policies for micro_categories
CREATE POLICY "Micro categories are viewable by everyone"
ON public.micro_categories FOR SELECT
USING (true);

CREATE POLICY "Admins can insert micro categories"
ON public.micro_categories FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admins can update micro categories"
ON public.micro_categories FOR UPDATE
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admins can delete micro categories"
ON public.micro_categories FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- RLS Policies for nano_categories
CREATE POLICY "Nano categories are viewable by everyone"
ON public.nano_categories FOR SELECT
USING (true);

CREATE POLICY "Admins can insert nano categories"
ON public.nano_categories FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admins can update nano categories"
ON public.nano_categories FOR UPDATE
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admins can delete nano categories"
ON public.nano_categories FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- Create category_hierarchy_index for fast lookup
CREATE TABLE IF NOT EXISTS public.category_hierarchy_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  sub_category_id UUID REFERENCES public.sub_categories(id) ON DELETE CASCADE,
  micro_category_id UUID REFERENCES public.micro_categories(id) ON DELETE CASCADE,
  nano_category_id UUID REFERENCES public.nano_categories(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (product_id)
);

CREATE INDEX IF NOT EXISTS idx_category_hierarchy_index_category_id ON public.category_hierarchy_index(category_id);
CREATE INDEX IF NOT EXISTS idx_category_hierarchy_index_sub_category_id ON public.category_hierarchy_index(sub_category_id);
CREATE INDEX IF NOT EXISTS idx_category_hierarchy_index_micro_category_id ON public.category_hierarchy_index(micro_category_id);
CREATE INDEX IF NOT EXISTS idx_category_hierarchy_index_nano_category_id ON public.category_hierarchy_index(nano_category_id);
CREATE INDEX IF NOT EXISTS idx_category_hierarchy_index_product_id ON public.category_hierarchy_index(product_id);

-- Enable RLS on category_hierarchy_index
ALTER TABLE public.category_hierarchy_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Category hierarchy index is viewable by everyone"
ON public.category_hierarchy_index FOR SELECT
USING (true);

CREATE POLICY "Admins can manage category hierarchy index"
ON public.category_hierarchy_index FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- Add deleted_at to all major tables for soft delete system
DO $$
BEGIN
  -- Add deleted_at to categories if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'categories' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE public.categories ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Add deleted_at to orders if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Add deleted_at to license_keys if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'license_keys' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE public.license_keys ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Add deleted_at to wallets if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'wallets' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE public.wallets ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Add deleted_at to resellers if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'resellers' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE public.resellers ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Create indexes for deleted_at columns
CREATE INDEX IF NOT EXISTS idx_categories_deleted_at ON public.categories(deleted_at);
CREATE INDEX IF NOT EXISTS idx_orders_deleted_at ON public.orders(deleted_at);
CREATE INDEX IF NOT EXISTS idx_license_keys_deleted_at ON public.license_keys(deleted_at);
CREATE INDEX IF NOT EXISTS idx_wallets_deleted_at ON public.wallets(deleted_at);
CREATE INDEX IF NOT EXISTS idx_resellers_deleted_at ON public.resellers(deleted_at);
