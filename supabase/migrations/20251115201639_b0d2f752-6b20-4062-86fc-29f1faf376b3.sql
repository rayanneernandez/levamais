-- Alterar constraint para incluir points_percentage
ALTER TABLE public.nps_rating_rewards_config 
DROP CONSTRAINT IF EXISTS nps_rating_rewards_config_reward_type_check;

ALTER TABLE public.nps_rating_rewards_config 
ADD CONSTRAINT nps_rating_rewards_config_reward_type_check 
CHECK (reward_type IN ('points_fixed', 'points_percentage', 'cashback_fixed', 'cashback_percentage'));