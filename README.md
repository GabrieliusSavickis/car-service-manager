# Car Service Manager

Welcome to the **Car Service Manager** project repository! This project is a comprehensive car service management application designed to streamline the scheduling, management, and tracking of car service appointments. Below, you'll find detailed information about the project's features, infrastructure, and setup.

## Project Overview

The **Car Service Manager** is a web-based application that allows service managers to efficiently schedule and manage car service appointments. The application is built using modern web technologies and is designed to be user-friendly, scalable, and secure.

### Key Features

- **Appointment Scheduling**: Administrators can schedule car service appointments, and technicians can update their progress, including marking tasks as completed.
- **Technician Hours Tracking**: The application tracks the hours each technician spends on appointments, including the ability to pause and resume appointments.
- **Service History**: Detailed service history is maintained for each vehicle, allowing users to view past appointments, tasks performed, and the technician responsible.
- **Real-Time Data**: The application uses Firebase Firestore for real-time data synchronization, ensuring that all users see the most up-to-date information.
- **Auto-Populate Account Details**: When scheduling a new appointment, the system auto-populates account details if the vehicle registration already exists, reducing data entry errors.

## Infrastructure and Hosting

### Domain Setup

I purchased a domain and set it up manually, configuring the DNS settings to point to Firebase Hosting. The domain is used to host the live version of the Car Service Manager application.

### Firebase Hosting

The project is hosted on Firebase Hosting, providing fast and secure hosting with automatic SSL provisioning. Firebase Hosting is also integrated with the Firebase Firestore database, allowing seamless real-time updates and data management.

### GitHub Actions

I have set up GitHub Actions to automate the deployment process. Every time changes are pushed to the main branch, GitHub Actions triggers a workflow that builds and deploys the application to Firebase Hosting. This ensures that the live site is always up to date with the latest changes.

## Database and Data Management

### Firebase Firestore

The application uses Firebase Firestore as its primary database. Firestore is a NoSQL cloud database that allows for real-time synchronization of data across multiple clients. The database is structured to efficiently handle the application's requirements, including:

- **Appointments Collection**: Stores details of each service appointment, including vehicle information, tasks, technician assignments, and time tracking data.
- **Accounts Collection**: Maintains customer and vehicle details, allowing for quick retrieval and auto-population during appointment scheduling.

### Real-Time Synchronization

Firestore's real-time synchronization ensures that all users (administrators and technicians) are always working with the most current data, whether they are scheduling new appointments or updating existing ones.

## Project Structure

The repository is structured into two main folders:

- **car-service-manager**: Contains all the project files, including the source code, components, and configuration files.
- **.github/workflows**: Contains the GitHub Actions workflows that automate the deployment process.