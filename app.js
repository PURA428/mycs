// 〇〇様（ユーザー）から提供されたFirebaseの合鍵
const firebaseConfig = {
  apiKey: "AIzaSyBIoqp43gprMf75muKXZagcIbc9nEvyImc",
  authDomain: "mycs-24212.firebaseapp.com",
  projectId: "mycs-24212",
  storageBucket: "mycs-24212.firebasestorage.app",
  messagingSenderId: "313356996691",
  appId: "1:313356996691:web:7e399db9233cf02ebdf6a6"
};

// Firebaseの初期化
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

// Firestoreのコレクション
const POSTS_COLLECTION = "posts";

document.addEventListener('DOMContentLoaded', () => {
    // UI要素の取得
    const appContainer = document.getElementById('appContainer');
    const loginOverlay = document.getElementById('loginOverlay');
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    const loginBtn = document.getElementById('loginBtn');
    const loginError = document.getElementById('loginError');
    const logoutBtn = document.getElementById('logoutBtn');
    
    const postInput = document.getElementById('postInput');
    const postBtn = document.getElementById('postBtn');
    const charCount = document.getElementById('charCount');
    const timeline = document.getElementById('timeline');

    // メディア添付関連のUI要素
    const mediaInput = document.getElementById('mediaInput');
    const attachMediaBtn = document.getElementById('attachMediaBtn');
    const mediaPreviewContainer = document.getElementById('mediaPreviewContainer');
    const mediaPreviewGrid = document.getElementById('mediaPreviewGrid');
    
    // モーダル関連の要素
    const imageModal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const closeImageModalBtn = document.getElementById('closeImageModalBtn');

    let unsubscribeSnapshot = null;
    let selectedMediaFiles = [];

    // ==========================================
    // 認証（ログイン・ログアウト）処理
    // ==========================================

    // ログイン状態の監視
    auth.onAuthStateChanged((user) => {
        if (user) {
            // ログイン成功時：ログイン画面を隠し、アプリ画面を表示
            loginOverlay.style.display = 'none';
            appContainer.style.display = 'flex';
            
            // データの読み込みを開始
            startRealtimeSync();
        } else {
            // 未ログイン時：アプリ画面を隠し、ログイン画面を表示
            loginOverlay.style.display = 'flex';
            appContainer.style.display = 'none';
            
            // データの読み込みを停止（セキュリティエラー防止）
            if (unsubscribeSnapshot) {
                unsubscribeSnapshot();
                unsubscribeSnapshot = null;
            }
        }
    });

    // ログインボタン処理
    loginBtn.addEventListener('click', async () => {
        const email = loginEmail.value.trim();
        const password = loginPassword.value.trim();
        if (!email || !password) {
            loginError.textContent = "メールアドレスとパスワードを入力してください";
            return;
        }

        loginBtn.disabled = true;
        loginBtn.textContent = "ログイン中...";
        loginError.textContent = "";

        try {
            await auth.signInWithEmailAndPassword(email, password);
            // 成功すると onAuthStateChanged が発火するのでここでの画面切り替えは不要
        } catch (error) {
            console.error("ログインエラー:", error);
            loginError.textContent = "ログインに失敗しました。情報が正しいか確認してください。";
            loginBtn.disabled = false;
            loginBtn.textContent = "ログイン";
        }
    });

    // ログアウト処理
    logoutBtn.addEventListener('click', () => {
        auth.signOut().then(() => {
            // 入力欄などをリセットしておく
            loginEmail.value = '';
            loginPassword.value = '';
            loginBtn.disabled = false;
            loginBtn.textContent = "ログイン";
            loginError.textContent = "";
        });
    });

    // ==========================================
    // 投稿とタイムライン処理
    // ==========================================

    function startRealtimeSync() {
        // すでに監視中の場合は二重に監視しないようにする
        if (unsubscribeSnapshot) return;

        unsubscribeSnapshot = db.collection(POSTS_COLLECTION)
            .orderBy("createdAt", "desc")
            .onSnapshot((snapshot) => {
                const posts = [];
                snapshot.forEach((doc) => {
                    posts.push({ id: doc.id, ...doc.data() });
                });
                renderTimeline(posts);
            }, (error) => {
                console.error("データの取得中にエラーが発生しました:", error);
                timeline.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">データの読み込みに失敗しました。アクセス権限を確認してください。</div>';
            });
    }

    // 投稿フォームの入力イベント
    postInput.addEventListener('input', updatePostBtnState);

    function updatePostBtnState() {
        postInput.style.height = 'auto';
        postInput.style.height = (postInput.scrollHeight) + 'px';
        const textLength = postInput.value.length;
        charCount.textContent = textLength;
        // テキストがある、またはメディアが選択されていれば投稿可能
        postBtn.disabled = textLength === 0 && selectedMediaFiles.length === 0;
    }

    // メディア添付ボタンのクリック
    attachMediaBtn.addEventListener('click', () => {
        mediaInput.click();
    });

    // ファイルが選択された時の処理
    mediaInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        // 最大4枚までの制限（X風に合わせる場合）
        const newFiles = files.slice(0, 4 - selectedMediaFiles.length);
        selectedMediaFiles = [...selectedMediaFiles, ...newFiles].slice(0, 4);
        
        renderMediaPreview();
        updatePostBtnState();
        
        // 連続して同じファイルを選べるようにリセット
        mediaInput.value = '';
    });

    // プレビューの描画処理
    function renderMediaPreview() {
        mediaPreviewGrid.innerHTML = '';
        if (selectedMediaFiles.length === 0) {
            mediaPreviewContainer.style.display = 'none';
            return;
        }

        mediaPreviewContainer.style.display = 'block';
        
        selectedMediaFiles.forEach((file, index) => {
            const fileUrl = URL.createObjectURL(file);
            const itemDiv = document.createElement('div');
            itemDiv.className = 'media-preview-item';
            
            let mediaEl = '';
            if (file.type.startsWith('image/')) {
                mediaEl = `<img src="${fileUrl}" alt="プレビュー" />`;
            } else if (file.type.startsWith('video/')) {
                mediaEl = `<video src="${fileUrl}" controls></video>`;
            }
            
            itemDiv.innerHTML = `
                ${mediaEl}
                <button class="remove-media-btn" data-index="${index}" title="削除">×</button>
            `;
            mediaPreviewGrid.appendChild(itemDiv);
        });

        // 削除ボタンにイベントを設定
        const removeBtns = mediaPreviewGrid.querySelectorAll('.remove-media-btn');
        removeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.getAttribute('data-index'), 10);
                selectedMediaFiles.splice(idx, 1);
                renderMediaPreview();
                updatePostBtnState();
            });
        });
    }

    // 投稿ボタンクリック時のデータ保存
    postBtn.addEventListener('click', async () => {
        const text = postInput.value.trim();
        if (text.length === 0 && selectedMediaFiles.length === 0) return;

        postBtn.disabled = true;
        const originalText = postBtn.textContent;
        postBtn.textContent = '送信中...';

        try {
            let mediaArray = [];

            // メディアが選択されている場合はStorageにアップロード
            if (selectedMediaFiles.length > 0) {
                postBtn.textContent = `メディアアップロード中...`;
                
                const uploadPromises = selectedMediaFiles.map(async (file, index) => {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `posts/${auth.currentUser.uid}/${Date.now()}_${index}_${Math.random().toString(36).substring(2)}.${fileExt}`;
                    const storageRef = storage.ref().child(fileName);
                    
                    await storageRef.put(file);
                    const url = await storageRef.getDownloadURL();
                    const type = file.type.startsWith('image/') ? 'image' : 'video';
                    
                    return { url, type };
                });

                // すべての画像を並行してアップロード
                mediaArray = await Promise.all(uploadPromises);
            }

            postBtn.textContent = '保存中...';

            await db.collection(POSTS_COLLECTION).add({
                text: text,
                media: mediaArray, // 複数メディアを配列で保存
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                userId: auth.currentUser ? auth.currentUser.uid : "unknown"
            });
        } catch (error) {
            console.error("投稿の保存に失敗しました:", error);
            alert("投稿に失敗しました。エラー: " + error.message);
        } finally {
            postInput.value = '';
            postInput.style.height = 'auto';
            charCount.textContent = '0';
            
            // プレビューのリセット
            selectedMediaFiles = [];
            renderMediaPreview();

            postBtn.textContent = originalText;
            updatePostBtnState(); 
        }
    });

    // 日時フォーマット関数
    function formatTime(timestamp) {
        if (!timestamp) return "たった今";
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }

    // タイムライン描画関数
    function renderTimeline(posts) {
        timeline.innerHTML = '';

        if (posts.length === 0) {
            timeline.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">まだ投稿はありません。<br>最初のつぶやきを投稿してみましょう！</div>';
            return;
        }

        posts.forEach(post => {
            const postEl = document.createElement('article');
            postEl.className = 'post';
            
            // 互換性対応: 古いデータ(mediaUrl)と新しいデータ(media配列)を吸収
            let mediaItems = [];
            if (post.media && Array.isArray(post.media)) {
                mediaItems = post.media;
            } else if (post.mediaUrl) {
                mediaItems = [{ url: post.mediaUrl, type: post.mediaType || 'image' }];
            }
            
            let mediaHTML = '';
            if (mediaItems.length > 0) {
                // 画像枚数に応じたグリッド構成 (最大4枚を想定したデザイン)
                const gridCount = Math.min(mediaItems.length, 4); 
                
                let gridItemsHTML = mediaItems.map(item => {
                    if (item.type === 'video') {
                        return `<div class="grid-item"><video src="${item.url}" controls></video></div>`;
                    } else {
                        // 画像の場合はクリックイベント用のクラス timeline-image と data-src を付与
                        return `<div class="grid-item"><img src="${item.url}" class="timeline-image" alt="投稿画像" loading="lazy" data-src="${item.url}"></div>`;
                    }
                }).join('');

                mediaHTML = `
                    <div class="post-media-container">
                        <div class="media-grid" data-count="${gridCount}">
                            ${gridItemsHTML}
                        </div>
                    </div>
                `;
            }

            postEl.innerHTML = `
                <div class="avatar">
                    <img src="https://ui-avatars.com/api/?name=User&background=random" alt="User Avatar">
                </div>
                <div class="post-content">
                    <div class="post-header">
                        <span class="post-name">ユーザー名</span>
                        <span class="post-username">@myself</span>
                        <span class="post-time">· ${formatTime(post.createdAt)}</span>
                    </div>
                    ${post.text ? `<div class="post-text">${escapeHTML(post.text)}</div>` : ''}
                    ${mediaHTML}
                </div>
            `;
            timeline.appendChild(postEl);
        });

        // 画像クリックイベント（拡大プレビュー表示）の登録
        const timelineImages = timeline.querySelectorAll('.timeline-image');
        timelineImages.forEach(img => {
            img.addEventListener('click', (e) => {
                const src = e.target.getAttribute('data-src');
                openImageModal(src);
            });
        });
    }

    // 画像モーダルの開閉処理
    function openImageModal(src) {
        modalImage.src = src;
        imageModal.classList.add('show');
        document.body.style.overflow = 'hidden'; // 背景のスクロールを防止
    }

    function closeImageModal() {
        imageModal.classList.remove('show');
        document.body.style.overflow = '';
        setTimeout(() => {
            modalImage.src = '';
        }, 250); // アニメーション終了後に画像を消す
    }

    closeImageModalBtn.addEventListener('click', closeImageModal);
    imageModal.addEventListener('click', (e) => {
        // 画像領域以外（背景）をクリックした場合のみ閉じる
        if (e.target === imageModal) {
            closeImageModal();
        }
    });

    // XSS対策
    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }
});
