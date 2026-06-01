-- Add configurable referral limit to networks (0 = unlimited)
ALTER TABLE public.networks ADD COLUMN referral_max_uses integer NOT NULL DEFAULT 0;