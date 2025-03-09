// Nhập đối tượng auth từ tệp cấu hình Firebase
import { auth } from "../login/firebase-config.js";

// Nhập các hàm từ Firebase Authentication SDK
import {
  onAuthStateChanged, // Hàm theo dõi thay đổi trạng thái đăng nhập
  signOut, // Hàm đăng xuất người dùng
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-auth.js";

// Nhập các hàm từ Firebase Realtime Database SDK
import {
  ref, // Hàm tạo tham chiếu đến vị trí trong cơ sở dữ liệu
  query, // Hàm tạo truy vấn để lọc hoặc sắp xếp dữ liệu
  limitToLast, // Hàm giới hạn số lượng mục cuối cùng trong truy vấn
  onValue, // Hàm lắng nghe thay đổi dữ liệu trong cơ sở dữ liệu
  set, // Hàm ghi dữ liệu vào cơ sở dữ liệu
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-database.js";

// Nhập đối tượng database từ tệp cấu hình Firebase
import { database } from "../login/firebase-config.js";

// Khai báo các biến toàn cục để quản lý bản đồ và các thành phần liên quan
let map, marker, userMarker, gpsPolyline; // Bản đồ, đánh dấu thiết bị, đánh dấu người dùng, đường vẽ GPS
let userLocation = null; // Vị trí người dùng hiện tại
let isSatelliteView = localStorage.getItem("satelliteView") === "true"; // Trạng thái chế độ vệ tinh (lấy từ localStorage)
let isTracking = false; // Trạng thái theo dõi thiết bị
let animationFrameId = null; // ID của animation frame để di chuyển đánh dấu
let isReplaying = false; // Trạng thái phát lại tuyến đường
let replayTimeoutId = null; // ID của timeout để phát lại tuyến đường
let isRouting = false; // Trạng thái hiển thị tuyến đường chỉ dẫn
let routeLayer = null; // Lớp tuyến đường trên bản đồ
let lastMarkerLatLng = null; // Vị trí cuối cùng của đánh dấu thiết bị
const UPDATE_TIME_UI = 1000; // Thời gian cập nhật giao diện (1 giây)
const MAX_WAYPOINTS = 10000; // Số điểm tối đa trên tuyến đường
let lastFilteredLat = null,
  lastFilteredLng = null; // Tọa độ đã lọc cuối cùng (dùng cho Kalman filter)
const MIN_DISTANCE_CHANGE = 0.000003; // Khoảng cách tối thiểu để cập nhật vị trí
const PAGE_LIMIT = 1000; // Giới hạn số lượng bản ghi GPS lấy từ Firebase
let currentReplaySpeed = 50; // Tốc độ phát lại tuyến đường (ms)
let replayIndex = 0; // Chỉ số hiện tại trong quá trình phát lại
let latlngs = []; // Mảng chứa các tọa độ tuyến đường
let isDarkMode = localStorage.getItem("darkMode") === "true"; //  Trạng thái chế độ tối (lấy từ localStorage)
// Tạo lớp bản đồ tiêu chuẩn từ OpenStreetMap
const standardTileLayer = L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 19, // Độ phóng tối đa
    attribution: "© OpenStreetMap contributors", // Thông tin bản quyền
  }
);

// Tạo lớp bản đồ vệ tinh từ Google
const satelliteTileLayer = L.tileLayer(
  "https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
  {
    maxZoom: 22, // Độ phóng tối đa
    subdomains: ["mt0", "mt1", "mt2", "mt3"], // Các subdomain của Google Maps
  }
);

// Hàm hiển thị thông báo trên giao diện
const showNotification = (message, duration = 3000) => {
  const notification = document.getElementById("notification"); // Lấy phần tử thông báo
  notification.textContent = message; // Đặt nội dung thông báo
  notification.style.display = "block"; // Hiển thị thông báo
  setTimeout(() => (notification.style.display = "none"), duration); // Ẩn sau khoảng thời gian (mặc định 3s)
};

// Hàm tính khoảng cách giữa hai điểm tọa độ (theo công thức Haversine)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Bán kính trái đất (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180; // Độ chênh lệch vĩ độ (radian)
  const dLon = ((lon2 - lon1) * Math.PI) / 180; // Độ chênh lệch kinh độ (radian)
  const a = // Công thức Haversine
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); // Trả về khoảng cách (km)
};

// Hàm lọc Kalman để làm mượt dữ liệu GPS
const kalmanFilter = (value, lastValue, speed, noiseBase = 0.1) => {
  if (lastValue === null) return value; // Nếu không có giá trị trước, trả về giá trị hiện tại
  const adjustedNoise = noiseBase * (1 + speed / 50); // Điều chỉnh nhiễu dựa trên tốc độ
  return lastValue + (value - lastValue) * Math.min(adjustedNoise, 1); // Làm mượt giá trị
};
// Hàm phân tích timestamp để chỉ lấy ngày (không lấy giờ)
const parseCustomTimestamp = (timestamp) => {
  if (typeof timestamp === "string") {
    // Nếu timestamp là chuỗi (ví dụ: "04/03/2025 15:30:45")
    const [datePart] = timestamp.split(" "); // Chỉ lấy phần ngày, bỏ phần giờ
    const [day, month, year] = datePart.split("/").map(Number); // Tách ngày, tháng, năm và chuyển thành số
    return new Date(year, month - 1, day); // Tạo đối tượng Date chỉ với ngày (tháng -1 vì JS đếm từ 0)
  }
  const date = new Date(timestamp * 1000); // Nếu là Unix timestamp, chuyển sang milliseconds
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()); // Chỉ lấy ngày từ timestamp
};

// Hàm khởi tạo bản đồ
const initMap = () => {
  map = L.map("map", { zoomControl: false }).setView(
    [20.972563, 105.983978],
    19
  ); // Tạo bản đồ Leaflet, không hiển thị nút zoom
  if (isSatelliteView)
    satelliteTileLayer.addTo(map); // Nếu chế độ vệ tinh, thêm lớp vệ tinh
  else standardTileLayer.addTo(map); // Ngược lại, thêm lớp tiêu chuẩn

  marker = L.marker([20.972563, 105.983978], {
    // Tạo đánh dấu cho thiết bị GPS
    icon: L.divIcon({
      className: "custom-marker", // Lớp CSS cho đánh dấu
      html: "📍", // Biểu tượng ghim
      iconSize: [32, 32], // Kích thước biểu tượng
    }),
  })
    .addTo(map) // Thêm vào bản đồ
    .bindPopup('Thiết bị GPS<br>Vị trí: <span id="popupLocation"></span>'); // Gắn popup hiển thị vị trí

  userMarker = L.marker([0, 0], {
    // Tạo đánh dấu cho vị trí người dùng
    icon: L.divIcon({
      className: "user-marker", // Lớp CSS cho đánh dấu
      html: "👱", // Biểu tượng người dùng
      iconSize: [32, 32], // Kích thước biểu tượng
    }),
  })
    .addTo(map) // Thêm vào bản đồ
    .bindPopup("Vị trí của bạn"); // Gắn popup hiển thị vị trí người dùng
};

// Hàm lắng nghe cập nhật GPS từ Firebase
const subscribeToGPSUpdates = async () => {
  const gpsRef = ref(database, "gps"); // Tạo tham chiếu đến nhánh "gps" trong cơ sở dữ liệu
  let lastUpdateTime = null; // Thời gian cập nhật cuối cùng

  if (!gpsPolyline) {
    // Nếu chưa có đường vẽ GPS
    gpsPolyline = L.polyline([], {
      // Tạo đường vẽ với các thuộc tính
      color: "green", // Màu xanh
      dashArray: "38", // Đường nét đứt
      weight: 10, // Độ dày
    }).addTo(map); // Thêm vào bản đồ
  }

  onValue(
    // Lắng nghe thay đổi dữ liệu từ Firebase
    query(gpsRef, limitToLast(PAGE_LIMIT)), // Giới hạn lấy 100 bản ghi cuối
    async (snapshot) => {
      const data = snapshot.val(); // Lấy dữ liệu từ snapshot
      if (!data) {
        // Nếu không có dữ liệu
        showNotification("Không có dữ liệu GPS."); // Hiển thị thông báo
        gpsPolyline.setLatLngs([]); // Xóa đường vẽ
        return;
      }

      const lastEntryKey = Object.keys(data).pop(); // Lấy khóa cuối cùng (bản ghi mới nhất)
      const lastData = data[lastEntryKey]; // Lấy dữ liệu bản ghi mới nhất
      const lat = Number(lastData.latitude); // Chuyển vĩ độ thành số
      const lng = Number(lastData.longitude); // Chuyển kinh độ thành số
      const speed = Number(lastData.speed); // Chuyển tốc độ thành số
      const timestamp = lastData.timestamp || Date.now(); // Lấy timestamp, mặc định là thời gian hiện tại

      if (isNaN(lat) || isNaN(lng) || isNaN(speed)) {
        // Nếu dữ liệu không hợp lệ
        showNotification("Dữ liệu GPS không hợp lệ."); // Hiển thị thông báo lỗi
        return;
      }

      const smoothLat = kalmanFilter(lat, lastFilteredLat, speed); // Làm mượt vĩ độ
      const smoothLng = kalmanFilter(lng, lastFilteredLng, speed); // Làm mượt kinh độ
      lastFilteredLat = smoothLat; // Cập nhật vĩ độ đã lọc
      lastFilteredLng = smoothLng; // Cập nhật kinh độ đã lọc

      const currentLatLng = marker.getLatLng(); // Lấy vị trí hiện tại của đánh dấu
      const distance = calculateDistance(
        // Tính khoảng cách từ vị trí hiện tại đến vị trí mới
        currentLatLng.lat,
        currentLatLng.lng,
        smoothLat,
        smoothLng
      );
      const currentTime = Date.now(); // Thời gian hiện tại
      const timeDiff = lastUpdateTime // Tính chênh lệch thời gian
        ? (currentTime - lastUpdateTime) / 1000
        : 0;
      lastUpdateTime = currentTime; // Cập nhật thời gian cuối

      if (distance < MIN_DISTANCE_CHANGE) return; // Nếu khoảng cách quá nhỏ, bỏ qua

      const endLatLng = L.latLng(smoothLat, smoothLng); // Tạo tọa độ mới

      const DISTANCE_THRESHOLD = 0.05; // Ngưỡng khoảng cách để định tuyến (0.05 km)
      if (lastMarkerLatLng && distance > DISTANCE_THRESHOLD) {
        // Nếu vượt ngưỡng
        const routeCoords = await fetchRouteFromOSRM([
          // Lấy tuyến đường từ OSRM
          { lat: lastMarkerLatLng.lat, lng: lastMarkerLatLng.lng },
          { lat: smoothLat, lng: smoothLng },
        ]);
        if (routeCoords.length > 0) {
          // Nếu có tuyến đường
          const formattedRoute = routeCoords.map((coord) => [
            coord[1],
            coord[0],
          ]); // Định dạng lại tọa độ
          gpsPolyline.addLatLng(formattedRoute[formattedRoute.length - 1]); // Thêm điểm cuối
        } else {
          gpsPolyline.addLatLng(endLatLng); // Nếu không có tuyến, thêm điểm trực tiếp
        }
      } else {
        gpsPolyline.addLatLng(endLatLng); // Thêm điểm trực tiếp nếu không cần định tuyến
      }

      const TIME_THRESHOLD = 60; // Ngưỡng thời gian (60 giây)
      if (
        distance > DISTANCE_THRESHOLD || // Nếu vượt ngưỡng khoảng cách
        (timeDiff > TIME_THRESHOLD && timeDiff !== 0) // Hoặc vượt ngưỡng thời gian
      ) {
        marker.setLatLng(endLatLng); // Cập nhật vị trí đánh dấu
        marker.setPopupContent(
          // Cập nhật nội dung popup
          `Thiết bị GPS<br>Vị trí: ${smoothLat.toFixed(6)}, ${smoothLng.toFixed(
            6
          )}`
        );
        if (isTracking) {
          // Nếu đang theo dõi
          map.flyTo([smoothLat, smoothLng], 19, {
            // Di chuyển bản đồ đến vị trí mới
            animate: true,
            duration: 1.5,
          });
        }
      } else {
        // Nếu thay đổi nhỏ
        const startLatLng = marker.getLatLng(); // Lấy vị trí bắt đầu
        const duration = 200; // Thời gian animation (200ms)
        const startTime = performance.now(); // Thời gian bắt đầu

        const animateMarker = (currentTime) => {
          // Hàm animation cho đánh dấu
          const elapsedTime = currentTime - startTime; // Thời gian đã trôi qua
          const progress = Math.min(elapsedTime / duration, 1); // Tiến độ (0-1)
          const newLat =
            startLatLng.lat + (endLatLng.lat - startLatLng.lat) * progress; // Tính vĩ độ mới
          const newLng =
            startLatLng.lng + (endLatLng.lng - startLatLng.lng) * progress; // Tính kinh độ mới
          marker.setLatLng([newLat, newLng]); // Cập nhật vị trí đánh dấu
          marker.setPopupContent(
            // Cập nhật nội dung popup
            `Thiết bị GPS<br>Vị trí: ${newLat.toFixed(6)}, ${newLng.toFixed(6)}`
          );
          if (progress < 1) {
            // Nếu chưa hoàn tất
            animationFrameId = requestAnimationFrame(animateMarker); // Tiếp tục animation
          } else if (isTracking) {
            // Nếu hoàn tất và đang theo dõi
            map.flyTo([smoothLat, smoothLng], 19, {
              // Di chuyển bản đồ
              animate: true,
              duration: 1.5,
            });
          }
        };
        animationFrameId = requestAnimationFrame(animateMarker); // Bắt đầu animation
      }

      lastMarkerLatLng = endLatLng; // Cập nhật vị trí cuối cùng
      updateUI(smoothLat, smoothLng, speed, timestamp); // Cập nhật giao diện người dùng
    },
    (error) => {
      // Xử lý lỗi
      showNotification("Lỗi kết nối Firebase: " + error.message);
    }
  );
};

// Hàm cập nhật giao diện chỉ với ngày, tốc độ, kinh độ, vĩ độ (không có giờ)
const updateUI = (lat, lng, speed, timestamp) => {
  document.getElementById("location").textContent = `${lat.toFixed(
    6
  )}, ${lng.toFixed(6)}`; // Cập nhật kinh độ, vĩ độ
  document.getElementById("speed").textContent = `${speed.toFixed(2)} km/h`; // Cập nhật tốc độ
  const date = parseCustomTimestamp(timestamp); // Phân tích timestamp để lấy ngày
  if (isNaN(date.getTime())) {
    // Nếu ngày không hợp lệ
    document.getElementById("date").textContent = "Không xác định"; // Hiển thị thông báo lỗi
  } else {
    // Nếu ngày hợp lệ
    document.getElementById("date").textContent =
      date.toLocaleDateString("vi-VN"); // Cập nhật ngày (định dạng Việt Nam)
  }
  // Không cập nhật giờ vì yêu cầu loại bỏ giờ
};

// Hàm lấy tuyến đường từ OSRM
async function fetchRouteFromOSRM(waypoints) {
  const coords = waypoints.map((p) => `${p.lng},${p.lat}`).join(";"); // Định dạng tọa độ thành chuỗi
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`; // URL API OSRM
  try {
    const response = await fetch(url); // Gửi yêu cầu API
    if (!response.ok) throw new Error("API định tuyến không phản hồi."); // Kiểm tra lỗi
    const data = await response.json(); // Lấy dữ liệu JSON
    if (data.routes && data.routes.length > 0) {
      // Nếu có tuyến đường
      return data.routes[0].geometry.coordinates; // Trả về tọa độ tuyến đường
    }
  } catch (error) {
    showNotification("Không thể tải tuyến đường: " + error.message); // Hiển thị lỗi
  }
  return []; // Trả về mảng rỗng nếu thất bại
}

// Hàm lấy mẫu điểm để giảm số lượng điểm trên tuyến đường
function samplePoints(points, maxPoints) {
  if (points.length <= maxPoints) return points; // Nếu số điểm nhỏ hơn tối đa, trả về nguyên bản
  showNotification(
    // Hiển thị thông báo nếu vượt quá
    `Tuyến đường quá dài (${points.length} điểm), chỉ hiển thị ${maxPoints} điểm.`
  );
  const sampled = []; // Mảng chứa điểm lấy mẫu
  const interval = (points.length - 1) / (maxPoints - 1); // Khoảng cách giữa các điểm
  for (let i = 0; i < maxPoints; i++) {
    // Lấy mẫu đều
    sampled.push(points[Math.round(i * interval)]);
  }
  return sampled; // Trả về danh sách điểm lấy mẫu
}

// Hàm tải lịch sử tuyến đường từ Firebase
const loadPathHistory = async () => {
  const gpsRef = ref(database, "gps"); // Tham chiếu đến nhánh "gps"
  onValue(
    query(gpsRef, limitToLast(PAGE_LIMIT)), // Lấy 100 bản ghi cuối
    async (snapshot) => {
      const data = snapshot.val(); // Lấy dữ liệu
      if (!data) {
        // Nếu không có dữ liệu
        showNotification("Không có dữ liệu lịch sử tuyến đường.");
        if (gpsPolyline) gpsPolyline.setLatLngs([]); // Xóa đường vẽ
        return;
      }

      const entries = Object.values(data) // Chuyển dữ liệu thành mảng
        .filter((item) => item && typeof item === "object") // Lọc các mục hợp lệ
        .sort(
          (a, b) => (a.timestamp || Date.now()) - (b.timestamp || Date.now())
        ); // Sắp xếp theo thời gian

      const latlngs = entries // Tạo mảng tọa độ
        .map((item) => ({
          lat: parseFloat(item.latitude),
          lng: parseFloat(item.longitude),
        }))
        .filter((item) => !isNaN(item.lat) && !isNaN(item.lng)); // Lọc tọa độ hợp lệ

      if (latlngs.length < 2) {
        // Nếu không đủ điểm
        showNotification("Không đủ điểm để vẽ tuyến đường.");
        if (gpsPolyline) gpsPolyline.setLatLngs([]); // Xóa đường vẽ
        return;
      }

      let fullRoute = []; // Mảng chứa toàn bộ tuyến đường
      const chunkSize = 10; // Kích thước đoạn để xử lý (10 điểm)
      for (let i = 0; i < latlngs.length - 1; i += chunkSize) {
        // Xử lý từng đoạn
        const chunk = latlngs.slice(i, i + chunkSize + 1); // Cắt đoạn
        const routeCoords = await fetchRouteFromOSRM(chunk); // Lấy tuyến đường từ OSRM
        if (routeCoords.length > 0) {
          // Nếu có tuyến đường
          const formattedRoute = routeCoords.map((coord) => [
            coord[1],
            coord[0],
          ]); // Định dạng lại tọa độ
          fullRoute = fullRoute.concat(formattedRoute.slice(0, -1)); // Thêm vào tuyến đầy đủ
        } else {
          fullRoute.push([chunk[0].lat, chunk[0].lng]); // Nếu không có, thêm điểm đầu
        }
      }
      fullRoute.push([
        latlngs[latlngs.length - 1].lat,
        latlngs[latlngs.length - 1].lng,
      ]); // Thêm điểm cuối

      const limitedPoints = samplePoints(fullRoute, MAX_WAYPOINTS); // Lấy mẫu điểm nếu vượt tối đa
      if (gpsPolyline) gpsPolyline.setLatLngs(limitedPoints); // Cập nhật đường vẽ
    },
    (error) => {
      showNotification("Lỗi kết nối Firebase: " + error.message); // Hiển thị lỗi
    }
  );
};

// Hàm xóa lịch sử tuyến đường
const clearPathHistory = async () => {
  try {
    await set(ref(database, "gps"), null); // Xóa toàn bộ dữ liệu trong nhánh "gps"
    if (gpsPolyline) gpsPolyline.setLatLngs([]); // Xóa đường vẽ trên bản đồ
    showNotification("Đã xóa lịch sử tuyến đường."); // Hiển thị thông báo thành công
  } catch (error) {
    showNotification("Lỗi khi xóa lịch sử: " + error.message); // Hiển thị lỗi
  }
};

// Hàm chuyển đổi giữa chế độ vệ tinh và tiêu chuẩn
const toggleSatelliteView = () => {
  if (isSatelliteView) {
    // Nếu đang ở chế độ vệ tinh
    map.removeLayer(satelliteTileLayer); // Xóa lớp vệ tinh
    standardTileLayer.addTo(map); // Thêm lớp tiêu chuẩn
  } else {
    // Nếu đang ở chế độ tiêu chuẩn
    map.removeLayer(standardTileLayer); // Xóa lớp tiêu chuẩn
    satelliteTileLayer.addTo(map); // Thêm lớp vệ tinh
  }
  isSatelliteView = !isSatelliteView; // Đảo trạng thái
  localStorage.setItem("satelliteView", isSatelliteView); // Lưu vào localStorage
};

// Hàm căn giữa bản đồ theo vị trí người dùng
const centerUserLocation = () => {
  if (userLocation)
    // Nếu có vị trí người dùng
    map.flyTo([userLocation.lat, userLocation.lng], 19, {
      // Di chuyển bản đồ đến vị trí
      animate: true,
      duration: 1.5,
    });
  else showNotification("Chưa xác định được vị trí người dùng."); // Hiển thị lỗi nếu không có
};

// Hàm lấy vị trí người dùng liên tục
const getUserLocationContinuously = () => {
  if (navigator.geolocation) {
    // Nếu trình duyệt hỗ trợ Geolocation
    const savedLocation = JSON.parse(localStorage.getItem("userLocation")); // Lấy vị trí đã lưu
    if (savedLocation) {
      // Nếu có vị trí lưu
      userLocation = savedLocation; // Cập nhật vị trí
      userMarker.setLatLng([userLocation.lat, userLocation.lng]); // Cập nhật đánh dấu
    }
    navigator.geolocation.watchPosition(
      // Theo dõi vị trí liên tục
      (position) => {
        // Khi có vị trí mới
        userLocation = {
          // Cập nhật vị trí người dùng
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        userMarker.setLatLng([userLocation.lat, userLocation.lng]); // Cập nhật đánh dấu
        localStorage.setItem("userLocation", JSON.stringify(userLocation)); // Lưu vào localStorage
      },
      () => showNotification("Không thể lấy vị trí của bạn."), // Xử lý lỗi
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 27000 } // Tùy chọn Geolocation
    );
  } else {
    showNotification("Trình duyệt không hỗ trợ Geolocation."); // Hiển thị lỗi nếu không hỗ trợ
  }
};

// Hàm hiển thị tuyến đường từ người dùng đến thiết bị
const showRoute = () => {
  if (!userLocation || !marker) {
    // Nếu thiếu vị trí người dùng hoặc đánh dấu
    showNotification(
      "Cần vị trí người dùng và thiết bị để hiển thị tuyến đường."
    );
    return;
  }

  if (isRouting) {
    // Nếu đang hiển thị tuyến đường
    if (routeLayer) {
      // Nếu có lớp tuyến đường
      map.removeControl(routeLayer); // Xóa lớp tuyến đường
      routeLayer = null; // Đặt lại biến
    }
    isRouting = false; // Tắt trạng thái định tuyến
    showNotification("Đã tắt chỉ đường."); // Hiển thị thông báo

    document.getElementById("route-instructions").classList.add("hidden");
    const distanceEl = document.getElementById("route-distance");
    const durationEl = document.getElementById("route-duration");
    distanceEl.style.color = isDarkMode ? "#ffffff" : "#0e0d0d"; // Sử dụng isDarkMode toàn cục
    durationEl.style.color = isDarkMode ? "#ffffff" : "#0e0d0d"; // Sử dụng isDarkMode toàn cục
    return;
  }

  const deviceLocation = marker.getLatLng(); // Lấy vị trí thiết bị
  routeLayer = L.Routing.control({
    // Tạo lớp định tuyến
    waypoints: [
      // Các điểm trên tuyến đường
      L.latLng(userLocation.lat, userLocation.lng),
      L.latLng(deviceLocation.lat, deviceLocation.lng),
    ],
    router: L.Routing.osrmv1({
      // Sử dụng OSRM làm dịch vụ định tuyến
      serviceUrl: "https://router.project-osrm.org/route/v1",
    }),
    lineOptions: { styles: [{ color: "#007AFF", opacity: 0.7, weight: 5 }] }, // Định dạng đường vẽ
    createMarker: () => null, // Không tạo đánh dấu mặc định
  }).addTo(map); // Thêm vào bản đồ

  document.getElementById("route-instructions").classList.remove("hidden"); // Hiển thị bảng hướng dẫn

  routeLayer.on("routesfound", (e) => {
    // Lắng nghe sự kiện khi tìm thấy tuyến đường
    const route = e.routes[0]; // Lấy tuyến đường đầu tiên
    const routeDistance = route.summary.totalDistance / 1000; // Khoảng cách (km)
    const routeDuration = route.summary.totalTime / 60; // Thời gian (phút)
    document.getElementById("distance").textContent = `${routeDistance.toFixed(
      2
    )} km`; // Cập nhật khoảng cách
    document.getElementById(
      "route-distance"
    ).textContent = `${routeDistance.toFixed(2)} km`; // Cập nhật khoảng cách
    document.getElementById(
      "route-duration"
    ).textContent = `${routeDuration.toFixed(0)} phút`; // Cập nhật thời gian

    let instructionsHTML = "<ul>"; // Chuẩn bị HTML cho hướng dẫn
    route.instructions.forEach((instruction, index) => {
      // Duyệt qua các hướng dẫn
      let text = instruction.text; // Lấy văn bản hướng dẫn
      const translations = {
        southwest: "tây nam",
        Head: "Đi thẳng",
        east: "hướng đông",
        west: "hướng tây",
        north: "hướng bắc",
        south: "hướng nam",
        "Turn left": "Rẽ trái",
        "Turn right": "Rẽ phải",
        Continue: "Tiếp tục",
        at: "tại",
        onto: "vào",
        toward: "về phía",
        roundabout: "vòng xuyến",
        "Exit roundabout": "Ra khỏi vòng xuyến",
        Destination: "Điểm đến",
        "You have arrived at your destination": "Bạn đã đến nơi",
        "You have arrived": "Bạn đã đến",
        your: "đích",
        "Make a U-turn": "Quay đầu",
        and: "và",
        on: "trên",
        "Take the exit": "Đi theo lối ra",
        "Keep left": "Giữ bên trái",
        "Keep right": "Giữ bên phải",
        "slightly left": "Chếch trái",
        "Slight right": "Chếch phải",
        Merge: "Nhập vào",
        "Take the ramp": "Đi theo đường dốc",
        In: "Trong",
        meters: "m",
        kilometers: "km",
        "Proceed to the route": "Đi theo lộ trình",
        Recalculating: "Đang tính toán lại",
        "Traffic circle": "Vòng xoay",
        "Leave the traffic circle": "Ra khỏi vòng xoay",
        Highway: "Đường cao tốc",
        Freeway: "Xa lộ",
        "Toll road": "Đường có thu phí",
        Bridge: "Cầu",
        Tunnel: "Hầm",
        Ferry: "Phà",
        "Pedestrian crossing": "Lối qua đường cho người đi bộ",
        "Speed bump": "Gờ giảm tốc",
        "Stop sign": "Biển báo dừng",
        "Enter the": "Vào",
        "Exit the": "Ra khỏi",
        "take the 1st exit": "rẽ lối ra thứ nhất",
        "take the 2nd exit": "rẽ lối ra thứ hai",
        "take the 3rd exit": "rẽ lối ra thứ ba",
        "take the 4th exit": "rẽ lối ra thứ bốn",
        straight: "thẳng",
        "the right": "bên phải",
        "Make a sharp right": "Rẽ phải gấp",
        "Traffic light": "Đèn giao thông",
        "Turn slightly left": "Rẽ chếch trái",
        "Turn slightly right": "Rẽ chếch phải",
        "Make a sharp left": "Rẽ trái gấp",
        "Bear left": "Đi chếch trái",
        "Bear right": "Đi chếch phải",
        "Take the next left": "Rẽ trái tiếp theo",
        "Take the next right": "Rẽ phải tiếp theo",
        "Follow the signs": "Theo biển chỉ dẫn",
        "Stay on the current road": "Đi trên đường hiện tại",
        "Pass the": "Đi qua",
        Intersection: "Ngã tư",
        Go: "Đi",
        northeast: "hướng đông bắc",
        "Cross the bridge": "Qua cầu",
        "Enter the tunnel": "Vào hầm",
        "Leave the tunnel": "Ra khỏi hầm",
        "Follow the curve": "Theo đường cong",
        "Turn back": "Quay lại",
        "Take the left": "Rẽ trái",
        "Take the right": "Rẽ phải",
        "Take the left onto": "Rẽ trái vào",
        "Take the right onto": "Rẽ phải vào",
        "Take the first left": "Rẽ trái đầu tiên",
        "Take the first right": "Rẽ phải đầu tiên",
        "Take the second left": "Rẽ trái thứ hai",
        "Take the second right": "Rẽ phải thứ hai",
        "Take the third left": "Rẽ trái thứ ba",
        "Take the third right": "Rẽ phải thứ ba",
        "Take the fourth left": "Rẽ trái thứ bốn",
        "Take the fourth right": "Rẽ phải thứ bốn",
        "Take the fifth left": "Rẽ trái thứ năm",
        "Take the fifth right": "Rẽ phải thứ năm",
        "Take the sixth left": "Rẽ trái thứ sáu",
        "Take the sixth right": "Rẽ phải thứ sáu",
        "Make a left U-turn": "Quay đầu trái",
        "Make a right U-turn": "Quay đầu phải",
        "Take the first exit": "Đi theo lối ra thứ nhất",
        "Take the second exit": "Đi theo lối ra thứ hai",
        "Take the third exit": "Đi theo lối ra thứ ba",
        "Take the fourth exit": "Đi theo lối ra thứ bốn",
        "Take the fifth exit": "Đi theo lối ra thứ năm",
        "Take the sixth exit": "Đi theo lối ra thứ sáu",
        "Take the seventh exit": "Đi theo lối ra thứ bảy",
        "Take the eighth exit": "Đi theo lối ra thứ tám",
        "Take the ninth exit": "Đi theo lối ra thứ chín",
        "Take the tenth exit": "Đi theo lối ra thứ mười",
      };
      Object.entries(translations).forEach(([key, value]) => {
        // Dịch văn bản
        text = text.replace(new RegExp(`\\b${key}\\b`, "gi"), value);
      });
      const distanceText =
        instruction.distance > 1000 // Định dạng khoảng cách
          ? `${(instruction.distance / 1000).toFixed(2)} km`
          : `${instruction.distance.toFixed(0)} m`;
      instructionsHTML += `<li>Bước ${
        index + 1
      }: ${text} (${distanceText})</li>`; // Thêm bước vào HTML
    });
    document.getElementById("route-instructions").innerHTML =
      instructionsHTML + "</ul>"; // Cập nhật hướng dẫn
  });

  isRouting = true; // Bật trạng thái định tuyến
  showNotification("Đang hiển thị chỉ đường."); // Hiển thị thông báo
};

// Hàm đặt lại đánh dấu về vị trí cuối cùng từ Firebase
const resetMarkerToLastFirebasePosition = () => {
  const gpsRef = ref(database, "gps"); // Tham chiếu nhánh "gps"
  onValue(
    query(gpsRef, limitToLast(1)), // Lấy bản ghi cuối cùng
    (snapshot) => {
      const data = snapshot.val(); // Lấy dữ liệu
      if (data) {
        // Nếu có dữ liệu
        const lastEntryKey = Object.keys(data)[0]; // Lấy khóa bản ghi cuối
        const lastData = data[lastEntryKey]; // Lấy dữ liệu bản ghi cuối
        const lat = Number(lastData.latitude); // Chuyển vĩ độ thành số
        const lng = Number(lastData.longitude); // Chuyển kinh độ thành số
        if (!isNaN(lat) && !isNaN(lng)) {
          // Nếu tọa độ hợp lệ
          marker.setLatLng([lat, lng]); // Cập nhật vị trí đánh dấu
          marker.setPopupContent(
            // Cập nhật popup
            `Thiết bị GPS<br>Vị trí: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
          );
          map.flyTo([lat, lng], 19, { animate: true, duration: 1.5 }); // Di chuyển bản đồ
        }
      }
    },
    { onlyOnce: true } // Chỉ lấy dữ liệu một lần
  );
};

// Hàm phát lại tuyến đường
const replayRoute = () => {
  if (!gpsPolyline) {
    // Nếu không có đường vẽ
    showNotification("Chưa có dữ liệu tuyến đường để phát lại.");
    return;
  }
  latlngs = gpsPolyline.getLatLngs() || []; // Lấy danh sách tọa độ
  if (latlngs.length < 2) {
    // Nếu không đủ điểm
    showNotification("Không đủ dữ liệu để phát lại.");
    return;
  }

  if (isReplaying) {
    // Nếu đang phát lại
    clearTimeout(replayTimeoutId); // Hủy timeout
    isReplaying = false; // Tắt trạng thái phát lại
    document.getElementById("replayProgress").style.display = "none"; // Ẩn thanh tiến độ
    showNotification("Đã dừng phát lại tuyến đường."); // Hiển thị thông báo
    resetMarkerToLastFirebasePosition(); // Đặt lại vị trí
    return;
  }

  isReplaying = true; // Bật trạng thái phát lại
  replayIndex = 0; // Bắt đầu từ đầu
  document.getElementById("replayProgress").style.display = "block"; // Hiển thị thanh tiến độ
  replay(); // Bắt đầu phát lại
};

// Hàm thực hiện phát lại tuyến đường
const replay = () => {
  if (replayIndex < latlngs.length && isReplaying) {
    // Nếu chưa hết tuyến đường và đang phát lại
    marker.setLatLng(latlngs[replayIndex]); // Cập nhật vị trí đánh dấu
    map.panTo(latlngs[replayIndex]); // Di chuyển bản đồ
    document.getElementById("progressBar").style.width = `${
      (replayIndex / (latlngs.length - 1)) * 100
    }%`; // Cập nhật thanh tiến độ
    replayIndex++; // Tăng chỉ số
    replayTimeoutId = setTimeout(replay, currentReplaySpeed); // Lên lịch bước tiếp theo
  } else {
    // Nếu hết tuyến hoặc dừng
    isReplaying = false; // Tắt trạng thái phát lại
    replayIndex = 0; // Đặt lại chỉ số
    document.getElementById("replayProgress").style.display = "none"; // Ẩn thanh tiến độ
    if (replayIndex >= latlngs.length) {
      // Nếu hoàn tất
      showNotification("Đã hoàn tất phát lại tuyến đường."); // Hiển thị thông báo
      resetMarkerToLastFirebasePosition(); // Đặt lại vị trí
    }
  }
};

// Hàm khởi tạo lắng nghe kết nối Firebase
const initFirebaseConnectionListener = () => {
  const connectedRef = ref(database, ".info/connected"); // Tham chiếu đến trạng thái kết nối
  onValue(connectedRef, (snap) => {
    // Lắng nghe thay đổi
    if (snap.val() === true) {
      // Nếu kết nối thành công
      showNotification("Đã kết nối tới Firebase.");
    } else {
      // Nếu mất kết nối
      showNotification("Mất kết nối với Firebase.");
    }
  });
};

// Theo dõi trạng thái đăng nhập
onAuthStateChanged(auth, (user) => {
  if (!user) {
    // Nếu không có người dùng
    window.location.href = "login.html"; // Chuyển hướng về trang đăng nhập
  } else {
    // Nếu có người dùng
    console.log("Người dùng đã đăng nhập:", user.uid); // Ghi log UID
    initMap(); // Khởi tạo bản đồ
    initFirebaseConnectionListener(); // Khởi tạo lắng nghe kết nối
    subscribeToGPSUpdates(); // Đăng ký cập nhật GPS
    loadPathHistory(); // Tải lịch sử tuyến đường
    getUserLocationContinuously(); // Lấy vị trí người dùng liên tục
    setInterval(() => {
      // Cập nhật thời gian mỗi giây
      document.getElementById("time").textContent =
        new Date().toLocaleTimeString("vi-VN");
    }, UPDATE_TIME_UI);
    if (localStorage.getItem("darkMode") === "true")
      // Áp dụng chế độ tối nếu đã lưu
      document.body.classList.add("dark-mode");
  }
});

// Sự kiện hiển thị/ẩn bảng điều khiển
document.getElementById("toggleControls").addEventListener("click", () => {
  document.getElementById("controlsContent").classList.toggle("show"); // Chuyển đổi lớp "show"
});

// Sự kiện chuyển đổi chế độ vệ tinh
document
  .getElementById("satelliteView")
  .addEventListener("click", toggleSatelliteView);

// Sự kiện căn giữa vị trí người dùng
document
  .getElementById("centerUserLocation")
  .addEventListener("click", centerUserLocation);

// Sự kiện hiển thị tuyến đường
document.getElementById("showRoute").addEventListener("click", showRoute);

// Sự kiện bật/tắt theo dõi thiết bị
document.getElementById("trackDevice").addEventListener("click", () => {
  isTracking = !isTracking; // Đảo trạng thái theo dõi
  showNotification(isTracking ? "Đang theo dõi thiết bị" : "Đã tắt theo dõi"); // Hiển thị thông báo
  if (marker) {
    // Nếu có đánh dấu
    map.flyTo(marker.getLatLng(), 19, { animate: true, duration: 1.5 }); // Di chuyển bản đồ
  }
});

// Sự kiện phát lại tuyến đường
document.getElementById("replayRoute").addEventListener("click", replayRoute);

// Sự kiện chuyển đổi chế độ tối
document.getElementById("darkMode").addEventListener("click", () => {
  document.body.classList.toggle("dark-mode"); // Chuyển đổi lớp "dark-mode"
  isDarkMode = document.body.classList.contains("dark-mode"); // Cập nhật giá trị isDarkMode
  document.getElementById("darkMode").innerHTML = `<i class="fas fa-${
    isDarkMode ? "sun" : "moon"
  }"></i>`; // Cập nhật biểu tượng
  localStorage.setItem("darkMode", isDarkMode ? "true" : "false"); // Lưu trạng thái vào localStorage
});

// Khôi phục chế độ tối từ localStorage (cập nhật isDarkMode)
if (localStorage.getItem("darkMode") === "true") {
  document.body.classList.add("dark-mode"); // Áp dụng chế độ tối
  document.getElementById("darkMode").innerHTML = '<i class="fas fa-sun"></i>'; // Đặt biểu tượng mặt trời
  isDarkMode = true; // Cập nhật isDarkMode
} else {
  document.getElementById("darkMode").innerHTML = '<i class="fas fa-moon"></i>'; // Đặt biểu tượng mặt trăng
  isDarkMode = false; // Cập nhật isDarkMode
}

// Sự kiện xóa lịch sử tuyến đường
document
  .getElementById("clearHistory")
  .addEventListener("click", clearPathHistory);

// Sự kiện đăng xuất
document.getElementById("logout").addEventListener("click", () => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId); // Hủy animation nếu có
  signOut(auth) // Đăng xuất
    .then(() => (window.location.href = "login.html")) // Chuyển hướng về trang đăng nhập
    .catch((error) => showNotification("Đăng xuất thất bại: " + error.message)); // Hiển thị lỗi
});

// Cập nhật tốc độ phát lại khi kéo thanh trượt
document.getElementById("replaySpeed").addEventListener("input", (e) => {
  currentReplaySpeed = parseInt(e.target.value); // Cập nhật tốc độ từ giá trị thanh trượt
  document.getElementById("replaySpeedValue").textContent = currentReplaySpeed; // Hiển thị tốc độ
  if (isReplaying) {
    // Nếu đang phát lại
    clearTimeout(replayTimeoutId); // Hủy timeout cũ
    replay(); // Tiếp tục với tốc độ mới
  }
});

// Xử lý phím tắt
document.addEventListener("keydown", (e) => {
  if (e.key === "s") toggleSatelliteView(); // Phím "s": chuyển đổi chế độ vệ tinh
  if (e.key === "r") replayRoute(); // Phím "r": phát lại tuyến đường
});
