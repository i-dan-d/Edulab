# 🔐 Hướng dẫn chỉnh sửa tài khoản Teacher

## 📍 Các file cần chỉnh sửa:

### 1. **File `teacher-login.html`**

#### A. Thay đổi thông tin đăng nhập thực tế (dòng 297-300):
```javascript
const TEACHER_CREDENTIALS = {
    username: 'teacher',        // ← Thay đổi tên đăng nhập
    password: 'edulab2024'      // ← Thay đổi mật khẩu
};
```

**Ví dụ:**
```javascript
const TEACHER_CREDENTIALS = {
    username: 'giaovien01',     // Tên đăng nhập mới
    password: 'MatKhau@2024!'   // Mật khẩu mạnh mới
};
```

#### B. Cập nhật thông tin hiển thị (dòng 240-241):
```html
<p>Tên đăng nhập: <code>teacher</code></p>
<p>Mật khẩu: <code>edulab2024</code></p>
```

**Thay thành:**
```html
<p>Tên đăng nhập: <code>giaovien01</code></p>
<p>Mật khẩu: <code>MatKhau@2024!</code></p>
```

## 🔒 Bảo mật nâng cao (tùy chọn):

### 1. **Mã hóa mật khẩu:**
Thay vì lưu mật khẩu thô, có thể sử dụng hash:

```javascript
// Thêm vào đầu file
function hashPassword(password) {
    // Simple hash - trong thực tế nên dùng bcrypt
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
}

const TEACHER_CREDENTIALS = {
    username: 'giaovien01',
    passwordHash: '-1234567890'  // Hash của mật khẩu thực
};
```

### 2. **Multiple accounts:**
```javascript
const TEACHER_ACCOUNTS = [
    { username: 'giaovien01', password: 'pass1', name: 'Nguyễn Văn A' },
    { username: 'giaovien02', password: 'pass2', name: 'Trần Thị B' },
    { username: 'admin', password: 'admin123', name: 'Quản trị viên' }
];
```

## 📤 Import/Export Data

### **Cấu trúc dữ liệu Import:**

File JSON cần có cấu trúc như sau:

```json
{
  "version": "1.0.0",
  "exportedAt": 1726738200000,
  "exportedDate": "2024-09-19T10:30:00.000Z",
  "customizations": {
    "simulation-id": {
      "simulationId": "simulation-id",
      "objectives": "Mục tiêu học tập (Markdown)",
      "instructions": "Hướng dẫn thực hiện (Markdown)", 
      "simulationTitle": "Tên thí nghiệm",
      "createdAt": 1726738000000,
      "updatedAt": 1726738200000,
      "version": "1.0.0"
    }
  },
  "metadata": {
    "totalCustomizations": 1,
    "exportSource": "EduLab Teacher Tools"
  }
}
```

### **Cách sử dụng Import:**

1. **Export dữ liệu hiện tại:**
   - Vào Teacher Tools
   - Click "📤 Xuất dữ liệu"
   - Lưu file JSON

2. **Chỉnh sửa file JSON:**
   - Mở file bằng text editor
   - Thêm/sửa customizations
   - Lưu file

3. **Import dữ liệu:**
   - Click "📥 Nhập dữ liệu" 
   - Chọn file JSON đã chỉnh sửa
   - Dữ liệu sẽ được merge với dữ liệu hiện tại

### **Markdown hỗ trợ:**

Trong `objectives` và `instructions` có thể sử dụng:

- **In đậm**: `**text**`
- *In nghiêng*: `*text*`
- Danh sách: `- item`
- Số thứ tự: `1. item`
- Liên kết: `[text](url)`
- Trích dẫn: `> quote`

## 🎯 Tips và Best Practices:

1. **Mật khẩu mạnh**: Ít nhất 8 ký tự, có chữ hoa, số, ký tự đặc biệt
2. **Backup thường xuyên**: Export dữ liệu customization định kỳ
3. **Test trước**: Thử login với tài khoản mới trước khi deploy
4. **Security**: Không share tài khoản, đổi mật khẩu định kỳ

## 🔧 Troubleshooting:

**Lỗi đăng nhập:**
- Kiểm tra username/password trong TEACHER_CREDENTIALS
- Clear browser cache và sessionStorage
- Kiểm tra console browser để debug

**Import thất bại:**
- Kiểm tra cấu trúc JSON đúng format
- Đảm bảo file có extension .json
- Kiểm tra dung lượng file không quá lớn

