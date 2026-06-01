
-- 1. Fix api_cache: Remove permissive public policy (service_role bypasses RLS automatically)
DROP POLICY IF EXISTS "Service role can manage cache" ON public.api_cache;

-- 2. Fix api_rate_limits: Remove permissive public policy  
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.api_rate_limits;

-- 3. Fix attendant_points: Remove permissive ALL policy, add service-role-only write
DROP POLICY IF EXISTS "System can update attendant points" ON public.attendant_points;

-- 4. Fix store_managers: Remove public attendant enumeration policy
DROP POLICY IF EXISTS "Anyone can search attendant by code for login" ON public.store_managers;

-- 5. Fix nps_rating_rewards_config: Replace broken self-referencing subquery policies
DROP POLICY IF EXISTS "Network managers can view own network reward config" ON public.nps_rating_rewards_config;
DROP POLICY IF EXISTS "Network managers can create own network reward config" ON public.nps_rating_rewards_config;
DROP POLICY IF EXISTS "Network managers can update own network reward config" ON public.nps_rating_rewards_config;
DROP POLICY IF EXISTS "Network managers can delete own network reward config" ON public.nps_rating_rewards_config;

CREATE POLICY "Network managers can view own network reward config"
ON public.nps_rating_rewards_config FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'network_manager') AND
  network_id = get_user_network_id(auth.uid())
);

CREATE POLICY "Network managers can create own network reward config"
ON public.nps_rating_rewards_config FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'network_manager') AND
  network_id = get_user_network_id(auth.uid())
);

CREATE POLICY "Network managers can update own network reward config"
ON public.nps_rating_rewards_config FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'network_manager') AND
  network_id = get_user_network_id(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'network_manager') AND
  network_id = get_user_network_id(auth.uid())
);

CREATE POLICY "Network managers can delete own network reward config"
ON public.nps_rating_rewards_config FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'network_manager') AND
  network_id = get_user_network_id(auth.uid())
);

-- 6. Fix nps_rating_rewards_applied: Replace broken self-referencing subquery
DROP POLICY IF EXISTS "Network managers can view own network applied rewards" ON public.nps_rating_rewards_applied;

CREATE POLICY "Network managers can view own network applied rewards"
ON public.nps_rating_rewards_applied FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'network_manager') AND
  network_id = get_user_network_id(auth.uid())
);
