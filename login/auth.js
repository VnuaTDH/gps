// Nhập các đối tượng auth (xác thực) và database (cơ sở dữ liệu) từ tệp cấu hình Firebase
import { auth, database } from "./firebase-config.js";

// Nhập các hàm và lớp từ Firebase Authentication SDK phiên bản 10.1.0
import {
  signInWithEmailAndPassword, // Hàm đăng nhập bằng email và mật khẩu
  createUserWithEmailAndPassword, // Hàm tạo tài khoản mới bằng email và mật khẩu
  GoogleAuthProvider, // Lớp cung cấp xác thực Google
  signInWithPopup, // Hàm đăng nhập bằng cửa sổ bật lên (popup)
  sendPasswordResetEmail, // Hàm gửi email đặt lại mật khẩu
  sendEmailVerification, // Hàm gửi email xác minh địa chỉ email
  signOut, // Hàm đăng xuất người dùng
  fetchSignInMethodsForEmail, // Hàm kiểm tra các phương thức đăng nhập liên kết với email
  setPersistence, // Hàm thiết lập cơ chế lưu trữ trạng thái đăng nhập
  browserLocalPersistence, // Hằng số để lưu trữ trạng thái đăng nhập trong bộ nhớ trình duyệt
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-auth.js";

// Nhập các hàm từ Firebase Realtime Database SDK để thao tác với cơ sở dữ liệu
import {
  ref, // Hàm tạo tham chiếu đến một vị trí trong cơ sở dữ liệu
  set, // Hàm ghi dữ liệu vào cơ sở dữ liệu
  update, // Hàm cập nhật dữ liệu tại một vị trí trong cơ sở dữ liệu
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-database.js";

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

// Bản đồ thông báo lỗi: ánh xạ mã lỗi Firebase thành thông báo tiếng Việt
const errorMessages = {
  "auth/invalid-email": "Email không hợp lệ", // Email sai định dạng
  "auth/user-not-found": "Tài khoản không tồn tại", // Không tìm thấy người dùng
  "auth/invalid-login-credentials": "Tài khoản hoặc mật khẩu không chính xác", // Sai thông tin đăng nhập
  "auth/wrong-password": "Mật khẩu không chính xác", // Mật khẩu sai
  "auth/missing-password": "Vui lòng nhập mật khẩu", // Thiếu mật khẩu
  "auth/email-already-in-use": "Email đã được đăng ký", // Email đã được sử dụng
  "auth/weak-password": "Mật khẩu phải có ít nhất 6 ký tự", // Mật khẩu quá yếu
  "auth/too-many-requests": "Sevrer quá tải, vui lòng thử lại sau", // Quá nhiều yêu cầu
  "auth/invalid-credential": "Thông tin đăng nhập không hợp lệ", // Thông tin xác thực sai
  "auth/network-request-failed": "Lỗi kết nối mạng", // Mất kết nối mạng
  "auth/popup-closed-by-user": "Đã hủy đăng nhập", // Người dùng đóng popup
  "auth/missing-email": "Vui lòng nhập email", // Thiếu email
  "auth/requires-recent-login":
    "Vui lòng đăng nhập lại để thực hiện thao tác này", // Yêu cầu đăng nhập lại
  "auth/user-disabled": "Tài khoản đã bị vô hiệu hóa", // Tài khoản bị khóa
  "auth/operation-not-allowed": "Phương thức đăng nhập không được kích hoạt", // Phương thức không được phép
  "auth/invalid-verification-code": "Mã xác minh không hợp lệ", // Mã xác minh sai
  "auth/invalid-verification-id": "ID xác minh không hợp lệ", // ID xác minh sai
  "auth/missing-verification-code": "Thiếu mã xác minh", // Thiếu mã xác minh
  "auth/expired-action-code": "Mã hành động đã hết hạn", // Mã hành động hết hạn
};

// Hàm trả về thông báo lỗi tương ứng với mã lỗi từ Firebase, nếu không có thì trả về lỗi mặc định
const getErrorMessage = (error) => {
  return errorMessages[error.code] || error.message || "Lỗi hệ thống"; // Ưu tiên mã lỗi, rồi tin nhắn lỗi, cuối cùng là thông báo chung
};

// Hàm kiểm tra định dạng email bằng biểu thức chính quy (regex)
const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Biểu thức chính quy: yêu cầu có ký tự trước @, sau @, và dấu chấm
  return re.test(String(email).toLowerCase()); // Kiểm tra email (chuyển thành chữ thường để không phân biệt hoa thường)
};

// Hàm hiển thị thông báo lỗi hoặc thành công trên giao diện
export const showError = (formType, message, isSuccess = false) => {
  const errorElement = document.getElementById(`${formType}-error`); // Lấy phần tử HTML theo ID (ví dụ: login-error)
  if (!errorElement) {
    // Nếu không tìm thấy phần tử
    console.error(`Element with ID ${formType}-error not found.`); // Ghi log lỗi vào console
    return; // Thoát hàm
  }
  errorElement.textContent = message; // Gán nội dung thông báo vào phần tử
  errorElement.className = `error-message${isSuccess ? " success" : ""}`; // Thêm lớp CSS (success nếu là thông báo thành công)
  errorElement.style.display = "block"; // Hiển thị phần tử
  setTimeout(() => {
    // Đặt hẹn giờ ẩn thông báo sau 5 giây
    errorElement.style.display = "none"; // Ẩn phần tử
  }, 5000); // Thời gian chờ: 5000ms (5 giây)
};

// Hàm kiểm tra email đã tồn tại trong hệ thống chưa
export const checkIfEmailExists = async (email) => {
  if (!validateEmail(email)) throw new Error("Định dạng email không hợp lệ"); // Kiểm tra định dạng email trước
  try {
    const methods = await fetchSignInMethodsForEmail(auth, email); // Gọi Firebase để lấy danh sách phương thức liên kết với email
    return {
      exists: methods.length > 0, // Trả về true nếu email đã tồn tại
      providers: methods, // Trả về danh sách phương thức (email, Google, v.v.)
    };
  } catch (error) {
    console.error("Lỗi kiểm tra email:", error); // Ghi log lỗi nếu có
    throw new Error(getErrorMessage(error)); // Ném lỗi với thông báo tùy chỉnh
  }
};

// Hàm xử lý đăng nhập bằng email và mật khẩu
export const handleEmailLogin = async (email, password) => {
  try {
    if (!validateEmail(email)) throw new Error("Định dạng email không hợp lệ"); // Kiểm tra định dạng email
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    ); // Đăng nhập bằng Firebase
    const user = userCredential.user; // Lấy thông tin người dùng từ kết quả đăng nhập
    if (!user.emailVerified) {
      // Nếu email chưa được xác minh
      await signOut(auth); // Đăng xuất người dùng
      throw new Error("Vui lòng xác minh email trước khi đăng nhập"); // Ném lỗi yêu cầu xác minh
    }
    // Cập nhật thông tin người dùng trong cơ sở dữ liệu
    await update(ref(database, `users/${user.uid}`), {
      email: userCredential.user.email, // Email của người dùng
      lastLogin: formattedDate, // Thời gian đăng nhập cuối
      provider: "email", // Phương thức đăng nhập là email
      emailVerified: user.emailVerified, // Trạng thái xác minh email
    });
    return user; // Trả về thông tin người dùng
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Lỗi đăng nhập:`, error); // Ghi log lỗi với thời gian ISO
    if (errorMessages) {
      // Nếu có bản đồ lỗi (có thể là lỗi typo, nên là error.code)
      showError("login", "Sai tài khoản hoặc mật khẩu"); // Hiển thị thông báo lỗi mặc định
    } else {
      showError("login", getErrorMessage(error)); // Hiển thị thông báo lỗi tùy chỉnh
    }
    throw new Error(getErrorMessage(error)); // Ném lỗi với thông báo
  }
};

// Hàm kiểm tra trạng thái xác minh email của người dùng
export const checkEmailVerification = async (user) => {
  try {
    await user.reload(); // Tải lại thông tin người dùng từ Firebase
    if (user.emailVerified) {
      // Nếu email đã được xác minh
      await update(ref(database, `users/${user.uid}`), {
        // Cập nhật cơ sở dữ liệu
        emailVerified: true, // Đánh dấu email đã xác minh
      });
    }
    return user; // Trả về thông tin người dùng
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Lỗi kiểm tra xác minh email:`,
      error
    ); // Ghi log lỗi
    throw new Error(getErrorMessage(error)); // Ném lỗi với thông báo
  }
};

// Hàm xử lý đăng ký tài khoản mới
export const handleSignup = async (email, password) => {
  try {
    if (!validateEmail(email)) throw new Error("Định dạng email không hợp lệ"); // Kiểm tra định dạng email
    if (password.length < 8)
      throw new Error("Mật khẩu phải có ít nhất 8 ký tự"); // Kiểm tra độ dài mật khẩu
    if (!/[A-Z]/.test(password))
      throw new Error("Mật khẩu phải chứa ít nhất 1 chữ hoa"); // Kiểm tra chữ cái in hoa
    if (!/\d/.test(password))
      throw new Error("Mật khẩu phải chứa ít nhất 1 số"); // Kiểm tra có số không
    const emailCheck = await checkIfEmailExists(email); // Kiểm tra email đã tồn tại chưa
    if (emailCheck.exists) {
      // Nếu email đã tồn tại
      throw new Error(
        "Email đã được đăng ký với phương thức: " +
          emailCheck.providers.join(", ")
      ); // Ném lỗi
    }
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    ); // Tạo tài khoản mới
    // Ghi thông tin người dùng vào cơ sở dữ liệu
    await set(ref(database, `users/${userCredential.user.uid}`), {
      email: userCredential.user.email, // Email của người dùng
      createdAt: formattedDate, // Thời gian tạo tài khoản
      emailVerified: false, // Trạng thái xác minh (mặc định là false)
    });
    await sendEmailVerification(userCredential.user); // Gửi email xác minh
    return userCredential.user; // Trả về thông tin người dùng
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Lỗi đăng ký:`, error); // Ghi log lỗi
    throw new Error(getErrorMessage(error)); // Ném lỗi với thông báo
  }
};

// Biến lưu thời gian gửi email xác minh cuối cùng
let lastSentTime = 0;
// Hàm gửi lại email xác minh
export const handleResendVerification = async () => {
  try {
    const user = auth.currentUser; // Lấy thông tin người dùng hiện tại
    if (!user) throw new Error("Người dùng không tồn tại"); // Nếu không có người dùng, ném lỗi
    const now = Date.now(); // Lấy thời gian hiện tại (theo milliseconds)
    if (now - lastSentTime < 30000) {
      // Nếu chưa đủ 30 giây kể từ lần gửi cuối
      showError("verification", "❌ Vui lòng chờ 30 giây trước khi gửi lại."); // Hiển thị thông báo
      return; // Thoát hàm
    }
    const actionCodeSettings = {
      // Cấu hình cho email xác minh
      url: `https://your-deployed-site.com/login.html`, // URL người dùng sẽ được chuyển đến sau khi xác minh
      handleCodeInApp: false, // Không xử lý mã trong ứng dụng
    };
    await sendEmailVerification(user); // Gửi email xác minh
    lastSentTime = now; // Cập nhật thời gian gửi cuối
    if (typeof startCountdown === "function") {
      // Nếu hàm startCountdown tồn tại
      startCountdown(); // Gọi hàm đếm ngược (không định nghĩa trong code này)
    }
    showError("verification", "✅ Email xác minh đã được gửi lại!", true); // Hiển thị thông báo thành công
  } catch (error) {
    showError("verification", "❌ Lỗi: " + getErrorMessage(error)); // Hiển thị thông báo lỗi
    console.error("Lỗi gửi lại email xác minh:", error); // Ghi log lỗi
  }
};

// Hàm xử lý đăng nhập bằng Google
export const handleGoogleLogin = async () => {
  try {
    const provider = new GoogleAuthProvider(); // Tạo đối tượng cung cấp xác thực Google
    provider.setCustomParameters({
      // Thiết lập tham số tùy chỉnh
      prompt: "select_account", // Yêu cầu người dùng chọn tài khoản Google
    });
    await setPersistence(auth, browserLocalPersistence); // Thiết lập lưu trữ trạng thái đăng nhập trong trình duyệt
    const result = await signInWithPopup(auth, provider); // Đăng nhập bằng popup Google
    // Ghi thông tin người dùng vào cơ sở dữ liệu
    await set(ref(database, `users/${result.user.uid}`), {
      email: result.user.email, // Email từ Google
      displayName: result.user.displayName, // Tên hiển thị từ Google
      lastLogin: formattedDate, // Thời gian đăng nhập cuối
      emailVerified: true, // Email từ Google luôn được xác minh
    });
    return true; // Trả về true nếu thành công
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Lỗi đăng nhập Google:`, error); // Ghi log lỗi
    throw new Error(getErrorMessage(error)); // Ném lỗi với thông báo
  }
};

// Hàm xử lý reset mật khẩu
export const handlePasswordReset = async (email) => {
  try {
    if (!validateEmail(email)) throw new Error("Định dạng email không hợp lệ"); // Kiểm tra định dạng email
    await sendPasswordResetEmail(auth, email); // Gửi email đặt lại mật khẩu
    return true; // Trả về true nếu thành công
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Lỗi reset mật khẩu:`, error); // Ghi log lỗi
    throw new Error(getErrorMessage(error)); // Ném lỗi với thông báo
  }
};

// Xuất đối tượng auth để sử dụng ở nơi khác
export { auth };
