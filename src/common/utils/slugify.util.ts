/**
 * Chuyển đổi chuỗi tiếng Việt có dấu thành slug không dấu, chuẩn URL.
 * Ví dụ: "Lập trình Next.js" -> "lap-trinh-nextjs-1713110400000"
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

  // 3. Dùng Date.now() để lấy timestamp tại thời điểm tạo (Mảng 13 chữ số)
  const timestamp = Date.now();

  return `${slug}-${timestamp}`;
}
