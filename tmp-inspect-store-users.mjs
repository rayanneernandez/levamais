import { createClient } from '@supabase/supabase-js';
const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);
const networkId = '74523068-702f-4fd7-a815-69c167384525';
const { data: managersData, error: managersError } = await supabase
  .from('store_managers')
  .select('id, user_id, access_profile_id, is_attendant, attendant_code, codigo_funcionario_pdv, store_id')
  .eq('network_id', networkId)
  .is('store_id', null);
console.log('managersError', managersError);
console.log('managersData', JSON.stringify(managersData, null, 2));
const managerIds = (managersData || []).map(m => m.id);
const { data: userTagsData, error: userTagsError } = await supabase
  .from('store_manager_tags')
  .select('store_manager_id, tag_id, user_tags(id, name, color)')
  .in('store_manager_id', managerIds);
console.log('userTagsError', userTagsError);
console.log('userTagsData', JSON.stringify(userTagsData, null, 2));
const userIds = [...new Set((managersData || []).map(m => m.user_id))];
const { data: profilesData, error: profilesError } = await supabase
  .from('profiles')
  .select('id, full_name, email, phone')
  .in('id', userIds);
console.log('profilesError', profilesError);
console.log('profilesData', JSON.stringify(profilesData, null, 2));
