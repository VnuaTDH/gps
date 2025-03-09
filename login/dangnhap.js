import {
  auth, // Đối tượng xác thực Firebase
  handleEmailLogin, // Hàm xử lý đăng nhập bằng email/mật khẩu
  handleSignup, // Hàm xử lý đăng ký tài khoản mới
  handleGoogleLogin, // Hàm xử lý đăng nhập bằng Google
  handlePasswordReset, // Hàm xử lý reset mật khẩu
  showError, // Hàm hiển thị thông báo lỗi/thành công
  checkEmailVerification, // Hàm kiểm tra trạng thái xác minh email
  handleResendVerification, // Hàm gửi lại email xác minh
} from "./auth.js";

import { database } from "./firebase-config.js";

// Nhập các hàm từ Firebase Realtime Database để thao tác với cơ sở dữ liệu
import {
  ref, // Hàm tạo tham chiếu đến vị trí trong cơ sở dữ liệu
  update, // Hàm cập nhật dữ liệu tại một vị trí trong cơ sở dữ liệu
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-database.js";

// Nhập các hàm từ Firebase Authentication để quản lý trạng thái đăng nhập
import {
  onAuthStateChanged, // Hàm theo dõi thay đổi trạng thái đăng nhập
  signOut, // Hàm đăng xuất người dùng
  fetchSignInMethodsForEmail, // Hàm kiểm tra phương thức đăng nhập liên kết với email
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-auth.js";

// Tạo đối tượng Date để lấy thời gian hiện tại
const now = new Date();
// Định dạng thời gian thành chuỗi: ngày/tháng/năm giờ:phút:giây (ví dụ: 04/03/2025 15:30:45)
const formattedDate =
  now.getDate() + // Lấy ngày trong tháng (1-31)
  "/" +
  (now.getMonth() + 1) + // Lấy tháng (0-11, cộng 1 để thành 1-12)
  "/" +
  now.getFullYear() + // Lấy năm đầy đủ (ví dụ: 2025)
  " " +
  now.getHours() + // Lấy giờ (0-23)
  ":" +
  now.getMinutes() + // Lấy phút (0-59)
  ":" +
  now.getSeconds(); // Lấy giây (0-59)

// ====== XỬ LÝ GIAO DIỆN ======

// Lấy phần tử nút chuyển đổi theme từ DOM
const themeToggle = document.getElementById("theme-toggle");
// Hàm chuyển đổi giữa theme sáng (light) và tối (dark)
const toggleTheme = () => {
  const currentTheme = document.documentElement.getAttribute("data-theme"); // Lấy theme hiện tại từ thuộc tính data-theme
  if (currentTheme === "dark") {
    // Nếu đang là theme tối
    document.documentElement.removeAttribute("data-theme"); // Xóa thuộc tính để chuyển về theme sáng
    themeToggle.innerHTML = '<i class="bx bx-moon"></i>'; // Đặt biểu tượng mặt trăng (dark mode)
    localStorage.setItem("theme", "light"); // Lưu theme sáng vào localStorage
  } else {
    // Nếu đang là theme sáng hoặc không có theme
    document.documentElement.setAttribute("data-theme", "dark"); // Đặt theme tối
    themeToggle.innerHTML = '<i class="bx bx-sun"></i>'; // Đặt biểu tượng mặt trời (light mode)
    localStorage.setItem("theme", "dark"); // Lưu theme tối vào localStorage
  }
};

// Kiểm tra và áp dụng theme đã lưu trong localStorage
const savedTheme = localStorage.getItem("theme"); // Lấy theme đã lưu
if (savedTheme === "dark") {
  // Nếu theme đã lưu là tối
  document.documentElement.setAttribute("data-theme", "dark"); // Áp dụng theme tối
  themeToggle.innerHTML = '<i class="bx bx-sun"></i>'; // Hiển thị biểu tượng mặt trời
} else {
  // Nếu không có hoặc là sáng
  themeToggle.innerHTML = '<i class="bx bx-moon"></i>'; // Hiển thị biểu tượng mặt trăng
}

// Thêm sự kiện click cho nút chuyển đổi theme
themeToggle.addEventListener("click", toggleTheme); // Khi nhấn nút, gọi hàm toggleTheme

// Hàm thay đổi trạng thái loading của nút (button)
const setLoadingState = (button, isLoading) => {
  if (isLoading) {
    // Nếu đang loading
    button.classList.add("loading"); // Thêm lớp CSS "loading"
    button.disabled = true; // Vô hiệu hóa nút
  } else {
    // Nếu không loading
    button.classList.remove("loading"); // Xóa lớp CSS "loading"
    button.disabled = false; // Kích hoạt lại nút
  }
};

// Hàm toggle hiển thị/ẩn mật khẩu
const togglePassword = (inputId) => {
  const input = document.getElementById(inputId); // Lấy ô nhập liệu mật khẩu theo ID
  const icon = document.querySelector(`[data-input="${inputId}"]`); // Lấy biểu tượng liên kết với ô nhập liệu
  if (input && icon) {
    // Nếu cả hai tồn tại
    if (input.type === "password") {
      // Nếu đang là kiểu mật khẩu (ẩn)
      input.type = "text"; // Chuyển sang hiển thị văn bản
      icon.classList.replace("bxs-show", "bxs-hide"); // Thay đổi biểu tượng từ "show" sang "hide"
    } else {
      // Nếu đang hiển thị văn bản
      input.type = "password"; // Chuyển lại thành mật khẩu (ẩn)
      icon.classList.replace("bxs-hide", "bxs-show"); // Thay đổi biểu tượng từ "hide" sang "show"
    }
  }
};
// Gắn sự kiện click cho tất cả biểu tượng toggle mật khẩu
document.querySelectorAll(".toggle-password").forEach((icon) => {
  // Duyệt qua tất cả phần tử có lớp "toggle-password"
  icon.addEventListener("click", function () {
    // Thêm sự kiện click
    const inputId = this.getAttribute("data-input"); // Lấy ID của ô nhập liệu liên kết
    togglePassword(inputId); // Gọi hàm togglePassword
    this.classList.toggle("bxs-show"); // Chuyển đổi lớp "bxs-show"
    this.classList.toggle("bxs-hide"); // Chuyển đổi lớp "bxs-hide"
  });
});

// Hàm đếm ngược cho nút gửi lại email xác minh
let countdownInterval = null; // Biến lưu interval (không dùng trong code này)
const COUNTDOWN_DURATION = 30; // Thời gian đếm ngược: 30 giây
const startCountdown = () => {
  const resendButton = document.getElementById("resend-verification"); // Lấy nút "Gửi lại xác minh"
  const countdownElement = document.getElementById("countdown"); // Lấy phần tử hiển thị thời gian đếm ngược
  let remaining = COUNTDOWN_DURATION; // Thời gian còn lại ban đầu
  resendButton.disabled = true; // Vô hiệu hóa nút gửi lại
  countdownElement.textContent = remaining; // Hiển thị thời gian còn lại

  const updateCountdown = () => {
    // Hàm cập nhật đếm ngược
    remaining -= 0.016; // Giảm mỗi 16ms (khoảng 60fps)
    countdownElement.textContent = Math.ceil(remaining); // Hiển thị số giây còn lại (làm tròn lên)
    if (remaining > 0) {
      // Nếu vẫn còn thời gian
      requestAnimationFrame(updateCountdown); // Gọi lại hàm này để tiếp tục đếm
    } else {
      // Nếu hết thời gian
      resendButton.disabled = false; // Kích hoạt lại nút
      countdownElement.textContent = ""; // Xóa nội dung đếm ngược
    }
  };
  requestAnimationFrame(updateCountdown); // Bắt đầu đếm ngược bằng requestAnimationFrame
};
// Cho phép auth.js gọi hàm startCountdown
window.startCountdown = startCountdown; // Xuất hàm ra phạm vi toàn cục để auth.js dùng

// ====== XỬ LÝ SỰ KIỆN ======

// Sự kiện đăng nhập bằng email/mật khẩu
document.getElementById("login-button").addEventListener("click", async () => {
  const button = document.getElementById("login-button"); // Lấy nút đăng nhập
  try {
    setLoadingState(button, true); // Đặt trạng thái loading cho nút
    const email = document.getElementById("login-email").value; // Lấy giá trị email từ ô nhập
    const password = document.getElementById("login-password").value; // Lấy giá trị mật khẩu từ ô nhập
    const user = await handleEmailLogin(email, password); // Gọi hàm đăng nhập từ auth.js
    await update(ref(database, `users/${user.uid}`), {
      // Cập nhật thời gian hoạt động cuối trong cơ sở dữ liệu
      lastActive: formattedDate,
    });
    window.location.href = "map.html"; // Chuyển hướng đến trang map.html
  } catch (error) {
    showError("login", error.message); // Hiển thị thông báo lỗi nếu có
  } finally {
    setLoadingState(button, false); // Tắt trạng thái loading dù thành công hay thất bại
  }
});

// Sự kiện đăng nhập bằng Google
document.getElementById("google-login").addEventListener("click", async () => {
  const button = document.getElementById("google-login"); // Lấy nút đăng nhập Google
  try {
    setLoadingState(button, true); // Đặt trạng thái loading
    const result = await handleGoogleLogin(); // Gọi hàm đăng nhập Google từ auth.js
    await update(ref(database, `users/${result.user.uid}`), {
      // Cập nhật thông tin người dùng trong cơ sở dữ liệu
      lastLogin: formattedDate, // Thời gian đăng nhập cuối
      provider: "google", // Phương thức đăng nhập là Google
      displayName: result.user.displayName, // Tên hiển thị từ Google
      photoURL: result.user.photoURL, // URL ảnh đại diện từ Google
    });
    window.location.href = "map.html"; // Chuyển hướng đến trang map.html
  } catch (error) {
    showError("login", error.message); // Hiển thị thông báo lỗi nếu có
  } finally {
    setLoadingState(button, false); // Tắt trạng thái loading
  }
});

// Theo dõi trạng thái đăng nhập của người dùng
onAuthStateChanged(auth, async (user) => {
  // Lắng nghe thay đổi trạng thái đăng nhập
  if (user) {
    // Nếu có người dùng đăng nhập
    await user.reload(); // Tải lại thông tin người dùng từ Firebase
    if (user.emailVerified) {
      // Nếu email đã được xác minh
      window.location.href = "map.html"; // Chuyển hướng đến map.html
    } else {
      // Nếu email chưa được xác minh
      document.getElementById("verification-screen").classList.remove("hidden"); // Hiển thị màn hình xác minh
      document.getElementById("verification-email-display").textContent =
        user.email; // Hiển thị email của người dùng
      startCountdown(); // Bắt đầu đếm ngược
      const verificationCheckInterval = setInterval(async () => {
        // Kiểm tra định kỳ trạng thái xác minh
        try {
          const updatedUser = await checkEmailVerification(user); // Kiểm tra xem email đã xác minh chưa
          if (updatedUser.emailVerified) {
            // Nếu đã xác minh
            clearInterval(verificationCheckInterval); // Dừng kiểm tra định kỳ
            await update(ref(database, `users/${updatedUser.uid}`), {
              // Cập nhật thông tin trong cơ sở dữ liệu
              lastLogin: formattedDate,
              emailVerified: true,
            });
            window.location.href = "map.html"; // Chuyển hướng đến map.html
          }
        } catch (error) {
          console.error("Lỗi kiểm tra xác minh:", error); // Ghi log lỗi nếu có
          clearInterval(verificationCheckInterval); // Dừng kiểm tra nếu lỗi
        }
      }, 3000); // Kiểm tra mỗi 3 giây
    }
  }
});

// Sự kiện gửi lại email xác minh
document
  .getElementById("resend-verification")
  .addEventListener("click", async () => {
    const button = document.getElementById("resend-verification"); // Lấy nút gửi lại xác minh
    try {
      setLoadingState(button, true); // Đặt trạng thái loading
      await handleResendVerification(); // Gọi hàm gửi lại email xác minh từ auth.js
    } catch (error) {
      showError("verification", error.message); // Hiển thị thông báo lỗi nếu có
    } finally {
      setLoadingState(button, false); // Tắt trạng thái loading
    }
  });

// Sự kiện đăng ký tài khoản mới
document.getElementById("signup-button").addEventListener("click", async () => {
  const button = document.getElementById("signup-button"); // Lấy nút đăng ký
  try {
    setLoadingState(button, true); // Đặt trạng thái loading
    const email = document.getElementById("signup-email").value; // Lấy giá trị email
    const password = document.getElementById("signup-password").value; // Lấy giá trị mật khẩu
    const confirmPassword = document.getElementById(
      "signup-password-confirm"
    ).value; // Lấy giá trị xác nhận mật khẩu
    if (!email.includes("@")) throw new Error("Email không hợp lệ"); // Kiểm tra email có ký tự "@" không
    if (password.length < 8)
      throw new Error("Mật khẩu phải có ít nhất 8 ký tự"); // Kiểm tra độ dài mật khẩu
    if (password !== confirmPassword) throw new Error("Mật khẩu không khớp"); // Kiểm tra mật khẩu trùng khớp
    const signInMethods = await fetchSignInMethodsForEmail(auth, email); // Kiểm tra email đã tồn tại chưa
    if (signInMethods.length > 0) {
      // Nếu email đã tồn tại
      throw new Error("Email đã tồn tại, vui lòng đăng nhập."); // Ném lỗi
    }
    const userCredential = await handleSignup(email, password); // Gọi hàm đăng ký từ auth.js
    document.getElementById("signup-form").classList.add("hidden"); // Ẩn form đăng ký
    document.getElementById("verification-screen").classList.remove("hidden"); // Hiển thị màn hình xác minh
    document.getElementById("verification-email-display").textContent = email; // Hiển thị email vừa đăng ký
  } catch (error) {
    showError("signup", error.message); // Hiển thị thông báo lỗi nếu có
  } finally {
    setLoadingState(button, false); // Tắt trạng thái loading
  }
});

// Sự kiện reset mật khẩu
document.getElementById("reset-button").addEventListener("click", async () => {
  const button = document.getElementById("reset-button"); // Lấy nút reset mật khẩu
  try {
    setLoadingState(button, true); // Đặt trạng thái loading
    const email = document.getElementById("reset-email").value; // Lấy giá trị email
    await handlePasswordReset(email); // Gọi hàm reset mật khẩu từ auth.js
    showError("forgot", "✅ Yêu cầu đặt lại mật khẩu đã được gửi!", true); // Hiển thị thông báo thành công
  } catch (error) {
    showError("forgot", error.message); // Hiển thị thông báo lỗi nếu có
  } finally {
    setLoadingState(button, false); // Tắt trạng thái loading
  }
});

// Sự kiện đăng xuất sau khi xác minh
document
  .getElementById("logout-after-verification")
  .addEventListener("click", () => {
    signOut(auth).then(() => {
      // Đăng xuất người dùng
      window.location.href = "login.html"; // Chuyển hướng về trang login.html
    });
  });

// Chuyển đổi giữa các form (đăng nhập, đăng ký, quên mật khẩu)
document.getElementById("register-btn").addEventListener("click", () => {
  // Nút "Đăng ký"
  document.getElementById("login-form").classList.add("hidden"); // Ẩn form đăng nhập
  document.getElementById("signup-form").classList.remove("hidden"); // Hiển thị form đăng ký
  document.querySelector(".container").classList.add("active"); // Thêm lớp "active" cho container
});
document.getElementById("login-btn").addEventListener("click", () => {
  // Nút "Đăng nhập"
  document.getElementById("signup-form").classList.add("hidden"); // Ẩn form đăng ký
  document.getElementById("login-form").classList.remove("hidden"); // Hiển thị form đăng nhập
  document.querySelector(".container").classList.remove("active"); // Xóa lớp "active" khỏi container
});
document.getElementById("forgot-password").addEventListener("click", (e) => {
  // Nút "Quên mật khẩu"
  e.preventDefault(); // Ngăn hành vi mặc định của liên kết
  document.getElementById("login-form").classList.add("hidden"); // Ẩn form đăng nhập
  document.getElementById("forgot-password-form").classList.remove("hidden"); // Hiển thị form quên mật khẩu
});
document.getElementById("back-to-login").addEventListener("click", (e) => {
  // Nút "Quay lại đăng nhập"
  e.preventDefault(); // Ngăn hành vi mặc định của liên kết
  document.getElementById("forgot-password-form").classList.add("hidden"); // Ẩn form quên mật khẩu
  document.getElementById("login-form").classList.remove("hidden"); // Hiển thị form đăng nhập
});

// Xử lý sự kiện nhấn Enter cho các form
const setupEnterEvents = () => {
  const handlers = new Map(); // Tạo Map để lưu các hàm xử lý sự kiện
  const addEnterListener = (element, buttonId) => {
    // Hàm thêm sự kiện nhấn Enter
    if (!element) return; // Nếu phần tử không tồn tại, thoát
    const oldHandler = handlers.get(element); // Lấy hàm xử lý cũ (nếu có)
    if (oldHandler) {
      // Nếu đã có hàm xử lý cũ
      element.removeEventListener("keydown", oldHandler); // Xóa sự kiện cũ
    }
    const newHandler = (e) => {
      // Hàm xử lý mới
      if (e.key === "Enter") {
        // Nếu phím Enter được nhấn
        e.preventDefault(); // Ngăn hành vi mặc định
        document.getElementById(buttonId)?.click(); // Kích hoạt nút tương ứng
      }
    };
    handlers.set(element, newHandler); // Lưu hàm xử lý mới vào Map
    element.addEventListener("keydown", newHandler); // Thêm sự kiện keydown
  };

  // Gắn sự kiện Enter cho các ô nhập liệu
  addEnterListener(document.getElementById("login-email"), "login-button"); // Ô email đăng nhập
  addEnterListener(document.getElementById("login-password"), "login-button"); // Ô mật khẩu đăng nhập
  addEnterListener(document.getElementById("signup-email"), "signup-button"); // Ô email đăng ký
  addEnterListener(document.getElementById("signup-password"), "signup-button"); // Ô mật khẩu đăng ký
  addEnterListener(
    document.getElementById("signup-password-confirm"),
    "signup-button"
  ); // Ô xác nhận mật khẩu
  addEnterListener(document.getElementById("reset-email"), "reset-button"); // Ô email reset mật khẩu
};

// Gắn lại sự kiện Enter khi chuyển đổi form (trì hoãn 50ms để đảm bảo DOM sẵn sàng)
document.getElementById("register-btn").addEventListener("click", () => {
  setTimeout(setupEnterEvents, 50); // Gọi sau 50ms khi nhấn "Đăng ký"
});
document.getElementById("login-btn").addEventListener("click", () => {
  setTimeout(setupEnterEvents, 50); // Gọi sau 50ms khi nhấn "Đăng nhập"
});
document.getElementById("forgot-password").addEventListener("click", () => {
  setTimeout(setupEnterEvents, 50); // Gọi sau 50ms khi nhấn "Quên mật khẩu"
});
document.getElementById("back-to-login").addEventListener("click", () => {
  setTimeout(setupEnterEvents, 50); // Gọi sau 50ms khi nhấn "Quay lại đăng nhập"
});
setupEnterEvents(); // Gọi ngay lần đầu để thiết lập sự kiện

// ====== KIỂM TRA ĐIỀU KIỆN MẬT KHẨU (ĐĂNG KÝ) ======

// Lấy ô nhập mật khẩu đăng ký
const signupPasswordInput = document.getElementById("signup-password");
if (signupPasswordInput) {
  // Nếu ô nhập tồn tại
  signupPasswordInput.addEventListener("input", () => {
    // Thêm sự kiện khi người dùng nhập
    const value = signupPasswordInput.value; // Lấy giá trị hiện tại của ô nhập
    const requirementLength = document.getElementById("requirement-length"); // Phần tử hiển thị yêu cầu độ dài
    const requirementUppercase = document.getElementById(
      "requirement-uppercase"
    ); // Phần tử hiển thị yêu cầu chữ hoa
    const requirementNumber = document.getElementById("requirement-number"); // Phần tử hiển thị yêu cầu số

    // Kiểm tra độ dài mật khẩu (>= 8 ký tự)
    if (value.length >= 8) {
      requirementLength.classList.add("valid"); // Thêm lớp "valid" nếu đạt
    } else {
      requirementLength.classList.remove("valid"); // Xóa lớp "valid" nếu không đạt
    }
    // Kiểm tra có chữ cái in hoa không
    if (/[A-Z]/.test(value)) {
      requirementUppercase.classList.add("valid"); // Thêm lớp "valid" nếu đạt
    } else {
      requirementUppercase.classList.remove("valid"); // Xóa lớp "valid" nếu không đạt
    }
    // Kiểm tra có số không
    if (/\d/.test(value)) {
      requirementNumber.classList.add("valid"); // Thêm lớp "valid" nếu đạt
    } else {
      requirementNumber.classList.remove("valid"); // Xóa lớp "valid" nếu không đạt
    }
  });
}
