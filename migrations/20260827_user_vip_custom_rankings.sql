ALTER TABLE rankings
ADD COLUMN IF NOT EXISTS vip_description text;

ALTER TABLE rankings
ADD COLUMN IF NOT EXISTS vip_voting_open boolean NOT NULL DEFAULT true;

ALTER TABLE ranking_options
ADD COLUMN IF NOT EXISTS vip_added_later boolean NOT NULL DEFAULT false;
