import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLogin, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trackEvent } from "@/lib/analytics";
import { ShieldCheck } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user, isSuccess } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false
    }
  });

  useEffect(() => {
    if (isSuccess && user) {
      setLocation(user.role === "admin" ? "/admin" : "/dashboard");
    }
  }, [isSuccess, user, setLocation]);

  const loginMutation = useLogin();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = (values: LoginFormValues) => {
    loginMutation.mutate(
      { data: values },
      {
        onSuccess: (data: any) => {
          trackEvent("sign_in_success", { role: data.role });
          queryClient.setQueryData(getGetMeQueryKey(), data);
          setLocation(data.role === "admin" ? "/admin" : "/dashboard");
        },
        onError: () => {
          trackEvent("sign_in_failed");
        },
      }
    );
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-[400px]">
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="h-16 w-16 bg-primary/10 rounded flex items-center justify-center mb-6">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-[40px] font-bold tracking-tight text-ink leading-tight" data-testid="heading-login">
            NHS Portal
          </h1>
          <p className="text-muted-foreground mt-2 text-[16px]" data-testid="text-login-subtitle">
            Leigh High School Member Hours
          </p>
        </div>

        <Card className="border-b-4 border-b-primary border-x border-t border-border shadow-sm bg-card rounded">
          <CardHeader className="pb-4 pt-6 px-6">
            <CardTitle className="text-[20px] font-bold text-ink">Sign In</CardTitle>
            <CardDescription className="text-[16px] text-muted-foreground">Access your volunteer dashboard</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {loginMutation.isError && (
              <Alert variant="destructive" className="mb-6 rounded" data-testid="alert-login-error">
                <AlertDescription>
                  {loginMutation.error?.data?.error || "We couldn't sign you in. Please check your details and try again."}
                </AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-ink text-[16px]">Username</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="FirstName-LastName" 
                          autoComplete="username"
                          autoCapitalize="none"
                          autoCorrect="off"
                          className="h-12 rounded text-[16px] border-border bg-background"
                          {...field} 
                          data-testid="input-username"
                        />
                      </FormControl>
                      <p className="text-[13px] text-muted-foreground mt-1.5">
                        First and last name separated by a hyphen
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-ink text-[16px]">Password</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          autoComplete="current-password"
                          placeholder="Student ID" 
                          className="h-12 rounded font-mono text-[16px] border-border bg-background"
                          {...field} 
                          data-testid="input-password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full h-12 text-[16px] font-semibold rounded bg-primary text-primary-foreground hover:bg-primary/90 mt-2" 
                  disabled={loginMutation.isPending}
                  data-testid="button-submit-login"
                >
                  {loginMutation.isPending ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
        
        <p className="text-center text-[13px] text-muted-foreground mt-8" data-testid="text-support">
          Forgot credentials? Contact{" "}
          <a className="text-primary font-medium underline-offset-4 hover:underline" href="mailto:562022@my.cuhsd.org">
            562022@my.cuhsd.org
          </a>
        </p>
      </div>
    </div>
  );
}
