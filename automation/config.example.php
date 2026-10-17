<?php
/* Save as <PLESK_SUBSCRIPTION_HOME>/private-acpro-meta/config.php. Never in httpdocs, public GitHub or chat. */
return [
  'app_secret' => 'REPLACE_WITH_META_APP_SECRET',
  'verify_token' => 'REPLACE_WITH_RANDOM_32_PLUS_CHARACTER_STRING',
  'worker_token' => 'REPLACE_WITH_DIFFERENT_RANDOM_32_PLUS_CHARACTER_STRING',
  // Choose exactly one supported official API login mode.
  // For Facebook Login set api_mode=facebook_login and add the *Page* token.
  // For Instagram Login keep instagram_login and an Instagram user token.
  'api_mode' => 'instagram_login',
  'instagram_access_token' => 'REPLACE_WITH_IG_PROFESSIONAL_TOKEN',
  'facebook_page_id' => 'REPLACE_WITH_FACEBOOK_PAGE_ID',
  'facebook_page_access_token' => 'REPLACE_WITH_NEW_PAGE_TOKEN_NOT_EXPOSED_TO_CHAT',
  'instagram_account_id' => 'REPLACE_WITH_IG_USER_ID',
  'replies_enabled' => false,
];