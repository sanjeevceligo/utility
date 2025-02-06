# utility
This repo is for repository for - 
1. Enabling microservices for all automation accounts
2. Generate Email assocaited with tokens from env files

**Prerequisites**
1. Pull latest platform.ts (updated/latest)
2. Have latest env file

<img width="1728" alt="Screenshot 2025-01-15 at 12 00 23 PM" src="https://github.com/user-attachments/assets/abc114a7-2665-40c0-a049-d4377cc225ce" />

Update the list of MS as required 

**Command to run files**
node finalMsEnable and node finalemail

**About files**
finalMsEnable - To enable MS for all automation accounts in env file
finalemail - Generate Email assocaited with tokens from env file
Sample.csv - Sample output sheet for email associated with tokens 
suiteResults.csv - Sample output sheet after enabling microservices for all automation accounts 

**Enabling microservices for all automation accounts**
This utility is to simplify process of enabling microservices for all automation accounts in env file.
Note the following: 
1. What it does is fetch UserID -> pass it inside payload in PATCH enable microservices endpoint https://api.staging.integrator.io/v1/users Note that it fetches the UserIDs from tokens in env file (please have platform.ts updated/latest).
2. Wherever token is invalid and therefore UserID also comes as undefined, there it will not update MS because token is invalid. Also, at the end of run, will get a sheet where added 1 column msEnable indicating whether the microservices were successfully enabled (True/False) (other fields userID). Sample sheet have added.
3. You can use this instead of creating a PR and enable MS directly from this utility.
4. Command to run utility - node finalMsEnable

**Generate Email assocaited with tokens from env files**

Run this with node finalemail

**Run set of commands multiple times**
node dockerautomation.js
Enter delay between every command run
Enter number of repetitions for running set of commands
