// Nhập hàm initializeApp từ Firebase App SDK để khởi tạo ứng dụng Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js";

// Nhập hàm getAuth từ Firebase Authentication SDK để lấy đối tượng xác thực
import { getAuth } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-auth.js";

// Nhập các hàm từ Firebase Realtime Database SDK để thao tác với cơ sở dữ liệu
import {
  getDatabase, // Hàm lấy đối tượng cơ sở dữ liệu thời gian thực
  ref, // Hàm tạo tham chiếu đến một vị trí trong cơ sở dữ liệu
  push, // Hàm tạo một khóa duy nhất và thêm dữ liệu vào cơ sở dữ liệu
  set, // Hàm ghi dữ liệu vào một vị trí cụ thể trong cơ sở dữ liệu
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-database.js";

// Đối tượng cấu hình Firebase chứa các thông tin cần thiết để kết nối với dự án Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDuL2yX_V0ZkZ_ttSbDrYm7PkqnE76oeNg",
  authDomain: "he-thong-gps.firebaseapp.com",
  projectId: "he-thong-gps",
  storageBucket: "he-thong-gps.firebasestorage.app",
  messagingSenderId: "254256560534",
  appId: "1:254256560534:web:f724d12c0832cba22745b7",
  measurementId: "G-5S41W100C9",
};

// Khởi tạo ứng dụng Firebase với cấu hình đã cung cấp và xuất ra để sử dụng
export const app = initializeApp(firebaseConfig);

// Lấy đối tượng xác thực từ ứng dụng Firebase và xuất ra để sử dụng
export const auth = getAuth(app);

// Lấy đối tượng cơ sở dữ liệu thời gian thực từ ứng dụng Firebase và xuất ra để sử dụng
export const database = getDatabase(app);

// Xuất các hàm ref, push, set để sử dụng trực tiếp trong các tệp khác
export { ref, push, set };
