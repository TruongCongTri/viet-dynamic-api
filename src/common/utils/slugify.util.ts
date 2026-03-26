/**
 * Chuyển đổi chuỗi tiếng Việt có dấu thành slug không dấu, chuẩn URL.
 * Ví dụ: "Lập trình Next.js 2026" -> "lap-trinh-nextjs-2026-a1b2c"
 */
export function slugify(input: string): string {
  if (!input) return '';

  let slug = input.toLowerCase().trim();

  // 1. Chuyển đổi các ký tự tiếng Việt đặc biệt
  slug = slug.replace(/[áàảãạăắằẳẵặâấầẩẫậ]/g, 'a');
  slug = slug.replace(/[éèẻẽẹêếềểễệ]/g, 'e');
  slug = slug.replace(/[íìỉĩị]/g, 'i');
  slug = slug.replace(/[óòỏõọôốồổỗộơớờởỡợ]/g, 'o');
  slug = slug.replace(/[úùủũụưứừửữự]/g, 'u');
  slug = slug.replace(/[ýỳỷỹỵ]/g, 'y');
  slug = slug.replace(/đ/g, 'd');

  // 2. Loại bỏ ký tự đặc biệt & chuẩn hóa khoảng trắng
  slug = slug
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // Xóa các dấu phụ còn sót lại
    .replace(/[^a-z0-9\s-]/g, '') // Xóa ký tự đặc biệt (trừ dấu cách và gạch ngang)
    .replace(/\s+/g, '-') // Thay khoảng trắng bằng gạch ngang
    .replace(/-+/g, '-') // Loại bỏ nhiều dấu gạch ngang liên tiếp
    .replace(/^-+|-+$/g, ''); // Cắt gạch ngang ở đầu và cuối

  const hash = shortHash(input);
  return `${slug}-${hash}`;
}

function shortHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(16).slice(0, 5);
}
