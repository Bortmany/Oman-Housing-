// Which agency profile edits need an admin to look again. An approved agency
// that changes its name or licence number must not stay approved on the old
// check — the admin approved THAT name and licence.
export type ReviewFields = {
  nameEn: string;
  nameAr: string | null;
  licenseNo: string | null;
};

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

export function profileChangeNeedsReview(
  current: ReviewFields,
  next: ReviewFields,
): boolean {
  return (
    norm(current.nameEn) !== norm(next.nameEn) ||
    norm(current.nameAr) !== norm(next.nameAr) ||
    norm(current.licenseNo) !== norm(next.licenseNo)
  );
}
