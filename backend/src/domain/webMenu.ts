export function validateAvailability(normalizedMenu: any, input: any): Record<string, boolean> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Availability must be an item-ID to boolean map');
  const ids = new Set((normalizedMenu.sections || []).flatMap((section: any) => (section.items || []).map((item: any) => String(item.id))));
  for (const [id, available] of Object.entries(input)) {
    if (!ids.has(id) || typeof available !== 'boolean') throw new Error('Availability must cite a corrected menu item and boolean state');
  }
  return input;
}

export function publicMenuPayload(version: any, labels: any[], translations: any[]) {
  const availability = validateAvailability(version.normalized_menu, version.availability || {});
  return {
    restaurantRef: version.restaurant_ref, locationRef: version.location_ref, menuRef: version.menu_ref,
    version: Number(version.version), currency: version.currency,
    sections: version.normalized_menu.sections.map((section: any) => ({ ...section,
      items: section.items.map((item: any) => ({ ...item, available: availability[item.id] !== false })) })),
    reviewedLabels: labels.map(label => ({ itemRef: label.item_ref, type: label.label_type, name: label.label_name })),
    reviewedTranslations: translations.map(translation => ({ locale: translation.locale, names: translation.translated_menu })),
  };
}
