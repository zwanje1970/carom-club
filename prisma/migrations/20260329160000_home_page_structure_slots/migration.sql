-- 홈 고정 블록을 페이지 빌더 슬롯으로 이관 (tournamentIntro, venueIntro, venueLink, nanguEntry).
-- 이미 해당 slotType 행이 있으면 건너뜀. sortOrder는 당시 홈 페이지 최대값 뒤에 4칸 연속 부여.

DO $$
DECLARE
  base_order int;
BEGIN
  SELECT COALESCE(MAX("sortOrder"), 0) INTO base_order FROM "PageSection" WHERE page = 'home';

  IF NOT EXISTS (SELECT 1 FROM "PageSection" WHERE page = 'home' AND "slotType" = 'tournamentIntro') THEN
    INSERT INTO "PageSection" (
      id, type, title, subtitle, description, "textAlign", page, placement,
      "imageUrl", "imageUrlMobile", "imageHeightPc", "imageHeightMobile",
      "linkType", "internalPage", "internalPath", "externalUrl", "openInNewTab",
      buttons, "isVisible", "sortOrder", "startAt", "endAt",
      "backgroundColor", "titleIconType", "titleIconName", "titleIconImageUrl", "titleIconSize",
      "sectionStyleJson", "slotType", "slotConfigJson",
      "createdAt", "updatedAt"
    ) VALUES (
      'home_slot_tournament_intro',
      'text',
      '구조: 대회 안내',
      NULL, NULL, 'center', 'home', 'content_middle',
      NULL, NULL, 400, 280,
      'none', NULL, NULL, NULL, false,
      '[]', true, base_order + 1, NULL, NULL,
      NULL, 'none', NULL, NULL, NULL,
      NULL, 'tournamentIntro', NULL,
      NOW(), NOW()
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "PageSection" WHERE page = 'home' AND "slotType" = 'venueIntro') THEN
    INSERT INTO "PageSection" (
      id, type, title, subtitle, description, "textAlign", page, placement,
      "imageUrl", "imageUrlMobile", "imageHeightPc", "imageHeightMobile",
      "linkType", "internalPage", "internalPath", "externalUrl", "openInNewTab",
      buttons, "isVisible", "sortOrder", "startAt", "endAt",
      "backgroundColor", "titleIconType", "titleIconName", "titleIconImageUrl", "titleIconSize",
      "sectionStyleJson", "slotType", "slotConfigJson",
      "createdAt", "updatedAt"
    ) VALUES (
      'home_slot_venue_intro',
      'text',
      '구조: 당구장 소개',
      NULL, NULL, 'center', 'home', 'content_middle',
      NULL, NULL, 400, 280,
      'none', NULL, NULL, NULL, false,
      '[]', true, base_order + 2, NULL, NULL,
      NULL, 'none', NULL, NULL, NULL,
      NULL, 'venueIntro', NULL,
      NOW(), NOW()
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "PageSection" WHERE page = 'home' AND "slotType" = 'venueLink') THEN
    INSERT INTO "PageSection" (
      id, type, title, subtitle, description, "textAlign", page, placement,
      "imageUrl", "imageUrlMobile", "imageHeightPc", "imageHeightMobile",
      "linkType", "internalPage", "internalPath", "externalUrl", "openInNewTab",
      buttons, "isVisible", "sortOrder", "startAt", "endAt",
      "backgroundColor", "titleIconType", "titleIconName", "titleIconImageUrl", "titleIconSize",
      "sectionStyleJson", "slotType", "slotConfigJson",
      "createdAt", "updatedAt"
    ) VALUES (
      'home_slot_venue_link',
      'text',
      '구조: 당구장 목록 링크',
      NULL, NULL, 'center', 'home', 'content_middle',
      NULL, NULL, 400, 280,
      'none', NULL, NULL, NULL, false,
      '[]', true, base_order + 3, NULL, NULL,
      NULL, 'none', NULL, NULL, NULL,
      NULL, 'venueLink', NULL,
      NOW(), NOW()
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "PageSection" WHERE page = 'home' AND "slotType" = 'nanguEntry') THEN
    INSERT INTO "PageSection" (
      id, type, title, subtitle, description, "textAlign", page, placement,
      "imageUrl", "imageUrlMobile", "imageHeightPc", "imageHeightMobile",
      "linkType", "internalPage", "internalPath", "externalUrl", "openInNewTab",
      buttons, "isVisible", "sortOrder", "startAt", "endAt",
      "backgroundColor", "titleIconType", "titleIconName", "titleIconImageUrl", "titleIconSize",
      "sectionStyleJson", "slotType", "slotConfigJson",
      "createdAt", "updatedAt"
    ) VALUES (
      'home_slot_nangu_entry',
      'text',
      '구조: 난구노트·난구해결사',
      NULL, NULL, 'center', 'home', 'content_middle',
      NULL, NULL, 400, 280,
      'none', NULL, NULL, NULL, false,
      '[]', true, base_order + 4, NULL, NULL,
      NULL, 'none', NULL, NULL, NULL,
      NULL, 'nanguEntry', NULL,
      NOW(), NOW()
    );
  END IF;
END $$;
