//Handle Signup
function signup(event) {
  event.preventDefault();
  const form = event.target;
  const signupButton = form.querySelector('button[type="submit"]');
  const originalButtonText = signupButton.innerText;

  // Disable button to prevent multiple submissions
  signupButton.disabled = true;
  signupButton.innerText = 'Signing Up...';

  const name = document.getElementById("signupName").value;
  const email = document.getElementById("signupEmail").value;
  const password = document.getElementById("signupPassword").value;
  const role = document.querySelector('input[name="role"]:checked').value;
  
  // Create user with Firebase Auth
  auth.createUserWithEmailAndPassword(email, password)
    .then((userCredential) => {
      // User created successfully. Now save additional info to Firestore.
      const user = userCredential.user;
      const userProfile = {
        uid: user.uid,
        name: name,
        email: email,
        role: role,
        courses: []
      };

      // Add role-specific fields
      if (role === 'student') {
        userProfile.college = document.getElementById('college').value;
        userProfile.course = document.getElementById('course').value;
        userProfile.year = document.getElementById('year').value;
        userProfile.mobile = document.getElementById('mobile').value;
      } else if (role === 'tutor') {
        userProfile.subject = document.getElementById('subject').value;
        userProfile.age = document.getElementById('age').value;
        userProfile.experience = document.getElementById('experience').value;
      }

      // Set the document in Firestore with the user's UID as the doc ID
      return db.collection('users').doc(user.uid).set(userProfile);
    })
    .then(() => {
      // On success, redirect to the login page
      window.location.href = "login.html";
    })
    .catch((error) => {
      alert(`Error: ${error.message}`);
      console.error("Signup Error:", error);
      // Re-enable the button on error
      signupButton.disabled = false;
      signupButton.innerText = originalButtonText;
    });
}

//Handle Login
function login(event) {
  event.preventDefault();
  const form = event.target;
  const loginButton = form.querySelector('button[type="submit"]');
  const originalButtonText = loginButton.innerText;

  // Disable button to prevent multiple submissions
  loginButton.disabled = true;
  loginButton.innerText = 'Logging In...';

  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  const role = document.querySelector('input[name="role"]:checked').value;

  auth.signInWithEmailAndPassword(email, password)
    .then((userCredential) => {
      // Signed in, now verify the role from Firestore
      return db.collection('users').doc(userCredential.user.uid).get();
    })
    .then((doc) => {
      if (doc.exists && doc.data().role === role) {
        // Role matches, login is successful. Redirect to the correct dashboard.
        if (role === 'tutor') {
          window.location.href = "tutor-dashboard.html";
        } else {
          window.location.href = "dashboard.html";
        }
      } else {
        // Role does not match or doc doesn't exist
        auth.signOut(); // Log out the user
        const correctRole = doc.exists ? doc.data().role : 'an unknown role';
        alert(`Login failed. You are trying to log in as a ${role}, but you are registered as a ${correctRole}.`);
        // Re-enable button on failure
        loginButton.disabled = false;
        loginButton.innerText = originalButtonText;
      }
    })
    .catch((error) => {
      alert(`Error: ${error.message}`);
      console.error("Login Error:", error);
      // Re-enable button on error
      loginButton.disabled = false;
      loginButton.innerText = originalButtonText;
    });
}

//Load Dashboard Info
function loadDashboard() {
  auth.onAuthStateChanged(user => {
    if (user) {
      // User is signed in, get their data from Firestore
      db.collection('users').doc(user.uid).get().then((doc) => {
        if (doc.exists) {
          const userData = doc.data();
          // Welcome message
          document.getElementById("welcomeUser").innerText = `Welcome, ${userData.name}!`;

          // --- STUDENT-SPECIFIC LOGIC ---
          // Enrolled Courses Panel
          const enrolledCoursesList = document.getElementById("enrolledCourses");
          if (enrolledCoursesList) {
            enrolledCoursesList.innerHTML = "";
            if (!userData.courses || userData.courses.length === 0) {
              enrolledCoursesList.innerHTML = "<li><p>No courses enrolled yet. You can enroll from the <a href='courses.html'>Courses</a> page.</p></li>";
            } else {
              // The `courses` array now stores objects {id, title}
              userData.courses.forEach(course => { 
                let li = document.createElement("li");
                // In the future, you could make this a link to the course details page
                li.innerText = course.title; 
                enrolledCoursesList.appendChild(li);
              });
            }
          }

          // --- TUTOR-SPECIFIC LOGIC ---
          if (userData.role === 'tutor') {
            loadTutorCourses(user.uid);
          }

          // Profile Panel
          const userProfileDiv = document.getElementById("userProfile");
          if (userProfileDiv) {
            let profileHTML = `
              <p><strong>Full Name:</strong> <span>${userData.name}</span></p>
              <p><strong>Email:</strong> <span>${userData.email}</span></p>
              <p><strong>Role:</strong> <span>${userData.role.charAt(0).toUpperCase() + userData.role.slice(1)}</span></p>
            `;
            if (userData.role === 'student') {
              profileHTML += `
                <p><strong>College:</strong> <span>${userData.college || 'N/A'}</span></p>
                <p><strong>Course:</strong> <span>${userData.course || 'N/A'}</span></p>
                <p><strong>Year:</strong> <span>${userData.year || 'N/A'}</span></p>
                <p><strong>Mobile:</strong> <span>${userData.mobile || 'N/A'}</span></p>
              `;
            } else if (userData.role === 'tutor') {
              profileHTML += `
                <p><strong>Subject:</strong> <span>${userData.subject || 'N/A'}</span></p>
                <p><strong>Age:</strong> <span>${userData.age || 'N/A'}</span></p>
                <p><strong>Experience:</strong> <span>${userData.experience || 'N/A'} years</span></p>
              `;
            }
            userProfileDiv.innerHTML = profileHTML;
          }
        } else {
          // Doc doesn't exist, something is wrong. Log out.
          console.error("User document not found in Firestore!");
          logout();
        }
      }).catch(error => {
        console.error("Error fetching user data:", error);
        logout();
      });
    } else {
      // No user is signed in, redirect to login page
      window.location.href = "login.html";
    }
  });
}

// New function to load courses created by a tutor
function loadTutorCourses(tutorId) {
  const tutorCoursesList = document.getElementById('tutorCoursesList');
  if (!tutorCoursesList) return;

  db.collection('courses').where('tutorId', '==', tutorId).orderBy('createdAt', 'desc').get()
    .then(querySnapshot => {
      tutorCoursesList.innerHTML = ''; // Clear existing list
      if (querySnapshot.empty) {
        tutorCoursesList.innerHTML = '<p>You have not created any courses yet.</p>';
        return;
      }
      querySnapshot.forEach(doc => {
        const course = doc.data();
        const courseId = doc.id;
        const courseElement = document.createElement('div');
        courseElement.classList.add('course-card-simple'); // A new simple style for the list
        courseElement.innerHTML = `
          <div class="course-info">
            <h4>${course.title}</h4>
          </div>
          <div class="course-actions">
            <a href="edit-course.html?id=${courseId}" class="btn-action edit-btn">Edit</a>
            <button onclick="deleteCourse('${courseId}', '${course.title}')" class="btn-action delete-btn">Delete</button>
          </div>
        `;
        tutorCoursesList.appendChild(courseElement);
      });
    })
    .catch(error => {
      console.error("Error fetching tutor courses: ", error);
      tutorCoursesList.innerHTML = '<p>Could not load your courses at this time.</p>';
    });
}

// New function to create a course
function createCourse(event) {
  event.preventDefault();
  const form = event.target;
  const createButton = form.querySelector('button[type="submit"]');
  const originalButtonText = createButton.innerText;

  const user = auth.currentUser;
  if (!user) {
    alert("You must be logged in to create a course.");
    window.location.href = 'login.html';
    return;
  }

  createButton.disabled = true;
  createButton.innerText = 'Creating...';

  const courseData = {
    title: document.getElementById('courseTitle').value,
    description: document.getElementById('courseDescription').value,
    imageUrl: document.getElementById('courseImage').value,
    category: document.getElementById('courseCategory').value,
    tutorId: user.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  db.collection('courses').add(courseData)
    .then(() => {
      alert('Course created successfully!');
      window.location.href = 'tutor-dashboard.html';
    })
    .catch(error => {
      alert(`Error: ${error.message}`);
      console.error("Error creating course: ", error);
      createButton.disabled = false;
      createButton.innerText = originalButtonText;
    });
}

// New function to delete a course
function deleteCourse(courseId, courseTitle) {
  if (confirm(`Are you sure you want to delete the course "${courseTitle}"? This action cannot be undone.`)) {
    db.collection('courses').doc(courseId).delete()
      .then(() => {
        alert('Course deleted successfully.');
        // Reload the list of courses for the tutor
        loadTutorCourses(auth.currentUser.uid);
      })
      .catch(error => {
        console.error("Error deleting course: ", error);
        alert('There was an error deleting the course.');
      });
  }
}

// New function to load course data for the edit page
function loadCourseForEdit() {
  const courseId = new URLSearchParams(window.location.search).get('id');
  if (!courseId) {
      alert('No course ID provided.');
      window.location.href = 'tutor-dashboard.html';
      return;
  }

  const form = document.querySelector('form');
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true; // Disable until data is loaded

  db.collection('courses').doc(courseId).get()
      .then(doc => {
          if (doc.exists) {
              const course = doc.data();
              // Check if the current user is the owner
              const user = auth.currentUser;
              if (user && user.uid === course.tutorId) {
                  document.getElementById('courseTitle').value = course.title;
                  document.getElementById('courseDescription').value = course.description;
                  document.getElementById('courseImage').value = course.imageUrl;
                  document.getElementById('courseCategory').value = course.category;
                  submitButton.disabled = false; // Enable form submission
              } else {
                  alert('You do not have permission to edit this course.');
                  window.location.href = 'tutor-dashboard.html';
              }
          } else {
              alert('Course not found.');
              window.location.href = 'tutor-dashboard.html';
          }
      })
      .catch(error => {
          console.error("Error fetching course for edit: ", error);
          alert('Could not load course data.');
          window.location.href = 'tutor-dashboard.html';
      });
}

// New function to update a course
function updateCourse(event) {
  event.preventDefault();
  const courseId = new URLSearchParams(window.location.search).get('id');
  if (!courseId) {
      alert('Error: Course ID is missing.');
      return;
  }

  const form = event.target;
  const updateButton = form.querySelector('button[type="submit"]');
  const originalButtonText = updateButton.innerText;

  updateButton.disabled = true;
  updateButton.innerText = 'Updating...';

  const updatedData = {
      title: document.getElementById('courseTitle').value,
      description: document.getElementById('courseDescription').value,
      imageUrl: document.getElementById('courseImage').value,
      category: document.getElementById('courseCategory').value,
  };

  db.collection('courses').doc(courseId).update(updatedData)
      .then(() => {
          alert('Course updated successfully!');
          window.location.href = 'tutor-dashboard.html';
      })
      .catch(error => {
          alert(`Error: ${error.message}`);
          console.error("Error updating course: ", error);
          updateButton.disabled = false;
          updateButton.innerText = originalButtonText;
      });
}

//Enroll in Course
function enroll(courseId, courseTitle) {
  const user = auth.currentUser;
  if (user) {
    const userRef = db.collection('users').doc(user.uid);

    // Create an object with the course ID and title for more structured data
    const courseToEnroll = {
      id: courseId,
      title: courseTitle
    };

    // Atomically add the new course object to the "courses" array field.
    userRef.update({
      courses: firebase.firestore.FieldValue.arrayUnion(courseToEnroll)
    }).then(() => {
      alert(`You have successfully enrolled in ${courseTitle}!`);
    }).catch(error => {
      console.error("Error enrolling in course: ", error);
      alert('There was an error enrolling in the course.');
    });
  } else {
    alert("Please login first to enroll in a course.");
    window.location.href = "login.html";
  }
}

//Logout
function logout() {
  auth.signOut().then(() => {
    window.location.href = "../index.html";
  }).catch((error) => {
    console.error("Logout Error:", error);
  });
}

// New function to load all courses for the public courses page
function loadAllCourses() {
  const container = document.getElementById('all-courses-container');
  if (!container) return;

  container.innerHTML = '<p>Loading courses...</p>';

  db.collection('courses').orderBy('createdAt', 'desc').get()
    .then(querySnapshot => {
      container.innerHTML = ''; // Clear loading message
      if (querySnapshot.empty) {
        container.innerHTML = '<p>No courses are available at the moment. Please check back later.</p>';
        return;
      }
      querySnapshot.forEach(doc => {
        const course = doc.data();
        const courseId = doc.id; // Get the unique document ID
        const courseCard = document.createElement('div');
        courseCard.classList.add('course-card');
        courseCard.innerHTML = `
          <img src="${course.imageUrl}" alt="${course.title}">
          <h3>${course.title}</h3>
          <p>${course.description}</p>
          <button class="btn enrollBtn" data-course-id="${courseId}" data-course-title="${course.title}">Enroll</button>
        `;
        container.appendChild(courseCard);
      });

      // Re-attach event listeners for the new enroll buttons
      const enrollButtons = document.querySelectorAll('.enrollBtn');
      enrollButtons.forEach(button => {
        button.addEventListener('click', (event) => {
          const courseId = event.target.getAttribute('data-course-id');
          const courseTitle = event.target.getAttribute('data-course-title');
          enroll(courseId, courseTitle);
        });
      });
    })
    .catch(error => {
      console.error("Error fetching all courses: ", error);
      container.innerHTML = '<p>Could not load courses due to an error.</p>';
    });
}

// Dashboard Panel Switching
function showPanel(panelId) {
  // Hide all content panels
  document.querySelectorAll('.content-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  // Deactivate all sidebar links
  document.querySelectorAll('.sidebar nav a').forEach(link => {
    link.classList.remove('active');
  });

  // Show the selected panel
  const panelToShow = document.getElementById(`${panelId}-panel`);
  if (panelToShow) panelToShow.classList.add('active');

  // Activate the clicked sidebar link
  const linkToActivate = document.querySelector(`.sidebar nav a[onclick="showPanel('${panelId}')"]`);
  if (linkToActivate) linkToActivate.classList.add('active');
}

// Attach event listeners when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Logic for the public courses page
  if (document.getElementById('all-courses-container')) {
    loadAllCourses();
  }

  // Logic for the dashboard pages
  if (document.body.classList.contains('dashboard-page')) {
      loadDashboard();
  }

  // Logic for the edit course page
  if (window.location.pathname.includes('edit-course.html')) {
      // Make sure user is logged in before trying to load
      auth.onAuthStateChanged(user => {
          if (user) {
              loadCourseForEdit();
          } else {
              alert('You must be logged in to edit a course.');
              window.location.href = 'login.html';
          }
      });
  }
});