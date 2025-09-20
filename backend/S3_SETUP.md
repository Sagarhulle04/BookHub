# AWS S3 Setup Guide for BookHub

## Prerequisites
1. AWS Account (free tier available)
2. AWS CLI installed (optional but recommended)

## Step 1: Create S3 Bucket

1. Go to AWS S3 Console: https://s3.console.aws.amazon.com/
2. Click "Create bucket"
3. Choose a unique bucket name (e.g., `bookhub-pdfs-yourname`)
4. Select a region (e.g., `us-east-1`)
5. Uncheck "Block all public access" (we need public read access for PDFs)
6. Check "I acknowledge that the current settings might result in this bucket and the objects within it becoming public"
7. Click "Create bucket"

## Step 2: Configure Bucket Policy

1. Go to your bucket → Permissions tab
2. Scroll down to "Bucket policy"
3. Add this policy (replace `YOUR_BUCKET_NAME` with your actual bucket name):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
        }
    ]
}
```

**Important Notes:**
- Replace `YOUR_BUCKET_NAME` with your exact bucket name (case-sensitive)
- Bucket names must be lowercase and can contain only letters, numbers, dots, and hyphens
- Example: If your bucket is named `bookhub-pdfs-sagar`, the resource should be:
  `"Resource": "arn:aws:s3:::bookhub-pdfs-sagar/*"`

**Common Bucket Name Issues:**
- Bucket names cannot contain uppercase letters
- Bucket names cannot contain underscores
- Bucket names must be globally unique across all AWS accounts

**Alternative: Use Bucket ACL Instead of Policy**
If the bucket policy gives you trouble, you can use a simpler approach:

1. Go to your bucket → Permissions tab
2. Scroll down to "Access Control List (ACL)"
3. Click "Edit"
4. Check "Read" under "Objects" for "Everyone (public access)"
5. Save changes

This is simpler but less secure than the bucket policy approach.

## Step 3: Create IAM User

1. Go to AWS IAM Console: https://console.aws.amazon.com/iam/
2. Click "Users" → "Create user"
3. Username: `bookhub-s3-user`
4. Select "Programmatic access"
5. Attach policy: `AmazonS3FullAccess` (or create a custom policy with minimal permissions)
6. Save the Access Key ID and Secret Access Key

## Step 4: Configure Environment Variables

Add these to your `.env` file:

```env
AWS_ACCESS_KEY_ID=your_access_key_id_here
AWS_SECRET_ACCESS_KEY=your_secret_access_key_here
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=your_bucket_name_here
```

## Step 5: Test the Setup

1. Restart your backend server
2. Try uploading a book using the new S3 endpoint: `POST /api/books/s3`
3. Check if the PDF loads correctly in the frontend

## Alternative: Local Storage (No AWS Required)

If you prefer not to use AWS, the local storage solution is already implemented and will work without any external services.

## Cost Considerations

- AWS S3 free tier: 5GB storage, 20,000 GET requests, 2,000 PUT requests per month
- After free tier: ~$0.023 per GB per month for storage
- Very cost-effective for small to medium applications

## Security Notes

- The bucket policy above makes all files publicly readable
- For production, consider using signed URLs for private files
- Regularly rotate your AWS access keys
- Monitor your S3 usage in the AWS console
